from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from agent.prompt_builder import (
    build_skills_system_prompt,
    clear_skills_system_prompt_cache,
)
from agent.capability_router import (
    CAPABILITY_RECEIPT_KEY,
    attach_agent_capability_receipt,
    capability_recommendation_prompt,
    initialize_new_session_capabilities,
    restore_agent_capability_receipt,
)
from agent.turn_budget import TurnGovernor, bind_turn_governor, governor_for_agent
from hermes_cli.capability_profile import TaskSkillDiscovery
from tools.delegate_tool import (
    _build_child_agent,
    _child_capability_payload,
    _route_child_capabilities,
)
from tools.skills_tool import _skill_view_with_bump, skills_list


def _skill(root, name: str, description: str) -> None:
    skill_dir = root / name
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {description}\n---\n# {name}\n",
        encoding="utf-8",
    )


def test_child_route_is_local_read_only_and_fail_closed_for_unallowed_skills():
    config = {
        "skills": {
            "allowed": ["codebase-inspection", "systematic-debugging"],
            "disabled": ["github-code-review"],
        }
    }
    before = deepcopy(config)
    parent = SimpleNamespace(_cached_system_prompt=b"parent-prompt")

    with (
        patch("agent.system_prompt._agent_home", return_value=None),
        patch("hermes_cli.config.read_raw_config", return_value=config),
        patch(
            "tools.skills_tool._find_all_skills",
            return_value=[
                {"name": "codebase-inspection"},
                {"name": "systematic-debugging"},
                {"name": "github-code-review"},
            ],
        ),
    ):
        route = _route_child_capabilities(parent, "Review and debug this code")

    assert route is not None
    assert route.selected == ("codebase-inspection", "systematic-debugging")
    assert route.recommended == ("github-code-review",)
    assert route.model_attempts == 0
    assert route.used_provider is False
    assert route.used_network is False
    assert config == before
    assert parent._cached_system_prompt == b"parent-prompt"


def test_legacy_profile_without_allowlist_keeps_existing_child_behavior():
    with (
        patch("agent.system_prompt._agent_home", return_value=None),
        patch("hermes_cli.config.read_raw_config", return_value={"skills": {}}),
        patch("tools.skills_tool._find_all_skills") as scan,
    ):
        assert _route_child_capabilities(SimpleNamespace(), "Review this code") is None

    scan.assert_not_called()


def test_child_receipt_scopes_prompt_and_reuses_root_governor(tmp_path):
    route = TaskSkillDiscovery(
        selected=("codebase-inspection",),
        recommended=("github-code-review",),
        reasons={
            "codebase-inspection": "Useful for software and product building.",
            "github-code-review": "Useful for software and product building.",
        },
    )
    parent = MagicMock()
    parent._delegate_depth = 0
    parent.enabled_toolsets = ["skills"]
    parent.disabled_toolsets = []
    parent._session_db = None
    parent._cached_system_prompt = b"parent-prompt"
    parent.valid_tool_names = {"skills_list", "skill_view"}
    parent.base_url = "http://mock.invalid/v1"
    parent.api_key = "mock"
    parent.provider = "mock"
    parent.api_mode = "chat_completions"
    parent.model = "mock-model"
    parent.platform = "cli"
    parent._print_fn = None
    parent.tool_progress_callback = None
    parent.thinking_callback = None

    child = MagicMock()
    child.session_id = "child-session"
    governor = TurnGovernor(
        turn_id="root-turn",
        model_warn_limit=3,
        model_hard_limit=4,
        tool_warn_limit=7,
        tool_hard_limit=8,
    )
    with (
        bind_turn_governor(governor),
        patch("tools.delegate_tool._route_child_capabilities", return_value=route),
        patch("run_agent.AIAgent", return_value=child),
    ):
        built = _build_child_agent(
            task_index=0,
            goal="Review this code carefully",
            context=None,
            toolsets=None,
            model=None,
            max_iterations=4,
            task_count=1,
            parent_agent=parent,
        )

    assert built is child
    assert child._capability_skills == ("codebase-inspection",)
    assert child._capability_recommended_skills == ("github-code-review",)
    assert child._active_turn_governor is governor
    assert parent._cached_system_prompt == b"parent-prompt"
    governor_for_agent(child).reserve_model_attempt(
        task="delegate_task", role="subagent"
    )
    assert governor.snapshot()["by_role"]["subagent"]["model_attempts"] == 1
    assert _child_capability_payload(child) == {
        "selected": ["codebase-inspection"],
        "recommended": ["github-code-review"],
        "reasons": route.reasons,
        "model_attempts": 0,
        "used_provider": False,
        "used_network": False,
    }

    skills_dir = tmp_path / "skills"
    _skill(skills_dir, "codebase-inspection", "Inspect a codebase")
    _skill(skills_dir, "github-code-review", "Review a pull request")
    clear_skills_system_prompt_cache(clear_snapshot=False)
    prompt = build_skills_system_prompt(
        skills_dir_override=skills_dir,
        skill_names=frozenset(child._capability_skills),
    )
    assert "codebase-inspection" in prompt
    assert "github-code-review" not in prompt


def test_skill_tools_cannot_escape_child_receipt():
    with (
        patch(
            "tools.skills_tool._find_all_skills",
            return_value=[
                {"name": "codebase-inspection", "description": "Inspect", "category": "dev"},
                {"name": "github-code-review", "description": "Review", "category": "dev"},
            ],
        ),
        patch("hermes_cli.plugins.discover_plugins"),
        patch("hermes_cli.plugins.get_plugin_manager") as manager,
    ):
        manager.return_value.list_plugin_skill_metadata.return_value = []
        payload = skills_list(allowed_skills=frozenset({"codebase-inspection"}))

    assert '"codebase-inspection"' in payload
    assert '"github-code-review"' not in payload

    with patch("tools.skills_tool.skill_view") as view:
        denied = _skill_view_with_bump(
            {"name": "github-code-review"},
            capability_skills=frozenset({"codebase-inspection"}),
        )
    assert "not assigned" in denied
    view.assert_not_called()


def test_model_dispatch_passes_exact_receipt_to_skill_tools():
    from model_tools import handle_function_call

    with patch("model_tools.registry.dispatch", return_value='{"success": true}') as dispatch:
        result = handle_function_call(
            "skills_list",
            {},
            task_id="child-task",
            session_id="child-session",
            capability_skills=("codebase-inspection",),
            skip_pre_tool_call_hook=True,
            skip_tool_request_middleware=True,
            skip_tool_execution_middleware=True,
        )

    assert result == '{"success": true}'
    assert dispatch.call_args.kwargs["capability_skills"] == frozenset(
        {"codebase-inspection"}
    )


def test_scoped_agent_cannot_mutate_or_tunnel_skill_access_through_execute_code():
    from model_tools import handle_function_call

    denied = handle_function_call(
        "skill_manage",
        {"action": "patch", "name": "github-code-review"},
        capability_skills=("codebase-inspection",),
    )
    assert "not available" in denied

    with patch("model_tools.registry.dispatch", return_value='{"success": true}') as dispatch:
        handle_function_call(
            "execute_code",
            {"code": "print('ok')"},
            task_id="child-task",
            enabled_tools=[
                "execute_code",
                "skills_list",
                "skill_view",
                "skill_manage",
                "read_file",
            ],
            capability_skills=("codebase-inspection",),
            skip_pre_tool_call_hook=True,
            skip_tool_request_middleware=True,
            skip_tool_execution_middleware=True,
        )

    sandbox_tools = dispatch.call_args.kwargs["enabled_tools"]
    assert "read_file" in sandbox_tools
    assert "skills_list" not in sandbox_tools
    assert "skill_view" not in sandbox_tools
    assert "skill_manage" not in sandbox_tools


def test_fresh_session_routes_once_then_keeps_prompt_and_receipt_byte_stable():
    route = TaskSkillDiscovery(
        selected=("codebase-inspection",),
        recommended=("github-code-review",),
        reasons={"github-code-review": "Useful for software building."},
    )
    agent = SimpleNamespace(
        platform="cli",
        _cached_system_prompt=None,
    )

    with patch(
        "agent.capability_router.route_agent_capabilities", return_value=route
    ) as router:
        first = initialize_new_session_capabilities(
            agent, "Review this code", conversation_history=None
        )
        agent._cached_system_prompt = b"frozen-parent-prompt"
        second = initialize_new_session_capabilities(
            agent, "Now write a newsletter", conversation_history=[]
        )

    assert first is route
    assert second is None
    router.assert_called_once_with(agent, "Review this code")
    assert agent._capability_skills == ("codebase-inspection",)
    assert agent._capability_recommended_skills == ("github-code-review",)
    assert agent._cached_system_prompt == b"frozen-parent-prompt"


def test_resumed_session_never_reclassifies_or_changes_persisted_prompt():
    agent = SimpleNamespace(platform="cli", _cached_system_prompt=None)
    history = [{"role": "user", "content": "earlier turn"}]

    with patch("agent.capability_router.route_agent_capabilities") as router:
        route = initialize_new_session_capabilities(
            agent, "Review this code", conversation_history=history
        )

    assert route is None
    router.assert_not_called()
    assert not hasattr(agent, "_capability_skills")


def test_unallowed_matches_are_prompted_as_recommendations_not_permissions():
    agent = SimpleNamespace(
        _capability_recommended_skills=("github-code-review",),
        _capability_skill_reasons={
            "github-code-review": "Useful for software building."
        },
    )

    note = capability_recommendation_prompt(agent)

    assert "github-code-review" in note
    assert "Useful for software building." in note
    assert "not authorized" in note
    assert "do not load, enable, or mutate" in note


def test_session_receipt_persists_with_hash_and_restores_exact_scope():
    route = TaskSkillDiscovery(
        selected=("codebase-inspection", "systematic-debugging"),
        recommended=("github-code-review",),
        reasons={"github-code-review": "Useful for software building."},
    )
    original = SimpleNamespace(_session_init_model_config={"max_iterations": 4})
    attach_agent_capability_receipt(original, route)
    record = original._session_init_model_config[CAPABILITY_RECEIPT_KEY]

    resumed = SimpleNamespace(_session_init_model_config={})
    assert restore_agent_capability_receipt(
        resumed, {CAPABILITY_RECEIPT_KEY: record}
    )
    assert resumed._capability_skills == route.selected
    assert resumed._capability_recommended_skills == route.recommended
    assert resumed._session_init_model_config[CAPABILITY_RECEIPT_KEY] == record


def test_tampered_session_receipt_restores_empty_scope_not_profile_catalog():
    route = TaskSkillDiscovery(
        selected=("codebase-inspection",),
        recommended=(),
        reasons={},
    )
    original = SimpleNamespace(_session_init_model_config={})
    attach_agent_capability_receipt(original, route)
    record = dict(original._session_init_model_config[CAPABILITY_RECEIPT_KEY])
    record["selected"] = ["github-code-review"]

    resumed = SimpleNamespace(_session_init_model_config={})
    assert restore_agent_capability_receipt(
        resumed, {CAPABILITY_RECEIPT_KEY: record}
    )
    assert resumed._capability_skills == ()
    assert resumed._capability_recommended_skills == ()
