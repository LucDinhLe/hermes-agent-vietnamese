from hermes_cli.capability_profile import (
    apply_work_profile,
    discover_task_skills,
    mark_work_profile_onboarding_required,
    reconcile_allowed_skill_catalog,
    recommend_skills,
    work_profile_state,
)


INSTALLED = {
    "document-to-action-items",
    "docx",
    "google-workspace",
    "grounded-citations",
    "meeting-action-items",
    "obsidian",
    "pdf",
    "powerpoint",
    "session-librarian",
    "xlsx",
    "arxiv",
    "llm-wiki",
    "hermes-agent",
    "codebase-inspection",
    "github-code-review",
    "systematic-debugging",
    "test-driven-development",
}


def test_recommendation_is_local_bounded_and_only_uses_installed_skills():
    result = recommend_skills(
        work_areas=["research_learning", "leadership_business"],
        common_tasks=[
            "Nghiên cứu và viết sách",
            "Soạn tài liệu đào tạo",
            "Tư vấn vận hành doanh nghiệp",
        ],
        installed_skills=INSTALLED,
    )

    assert 8 <= len(result.skills) <= 15
    assert set(result.skills) <= INSTALLED
    assert "grounded-citations" in result.skills
    assert "document-to-action-items" in result.skills
    assert "google-workspace" in result.skills
    assert result.reasons["grounded-citations"]
    assert result.used_provider is False


def test_apply_profile_atomically_separates_allowed_from_disabled():
    config = {"skills": {"disabled": []}, "model": {"default": "mock-model"}}
    allowed = {
        "grounded-citations",
        "document-to-action-items",
        "google-workspace",
        "obsidian",
        "session-librarian",
        "docx",
        "powerpoint",
        "pdf",
    }

    updated = apply_work_profile(
        config,
        installed_skills=INSTALLED,
        allowed_skills=allowed,
        work_areas=["research_learning"],
        common_tasks=["Nghiên cứu và viết tài liệu đào tạo"],
        skipped=False,
    )

    assert updated is config
    assert set(config["skills"]["allowed"]) == allowed
    assert set(config["skills"]["disabled"]) == INSTALLED - allowed
    assert config["skills"]["work_profile"]["completed"] is True
    assert config["skills"]["work_profile"]["skipped"] is False
    assert config["model"] == {"default": "mock-model"}


def test_legacy_profile_is_preserved_until_the_user_explicitly_applies():
    config = {"skills": {"disabled": ["pdf"]}}

    state = work_profile_state(config, installed_skills=INSTALLED)

    assert state.completed is False
    assert state.legacy is True
    assert state.allowed is None
    assert config == {"skills": {"disabled": ["pdf"]}}


def test_fresh_profile_marker_is_explicit_idempotent_and_cleared_on_apply():
    config = {}

    assert mark_work_profile_onboarding_required(config) is True
    assert mark_work_profile_onboarding_required(config) is False

    state = work_profile_state(config, installed_skills=INSTALLED)
    assert state.onboarding_required is True
    assert state.legacy is False
    assert state.allowed is None

    apply_work_profile(
        config,
        installed_skills=INSTALLED,
        allowed_skills={"docx"},
        work_areas=["writing_content"],
        common_tasks=["Draft a brief"],
        skipped=False,
    )

    completed = work_profile_state(config, installed_skills=INSTALLED)
    assert completed.completed is True
    assert completed.onboarding_required is False


def test_shipped_template_marks_only_a_new_default_profile_for_onboarding():
    from pathlib import Path

    import yaml

    template = Path(__file__).resolve().parents[2] / "cli-config.yaml.example"
    config = yaml.safe_load(template.read_text(encoding="utf-8"))

    state = work_profile_state(config, installed_skills=INSTALLED)
    assert state.onboarding_required is True
    assert state.legacy is False


def test_skip_completes_birth_with_every_skill_disabled():
    config = {}

    apply_work_profile(
        config,
        installed_skills=INSTALLED,
        allowed_skills=set(),
        work_areas=[],
        common_tasks=[],
        skipped=True,
    )

    state = work_profile_state(config, installed_skills=INSTALLED)
    assert state.completed is True
    assert state.skipped is True
    assert state.allowed == ()
    assert set(config["skills"]["disabled"]) == INSTALLED


def test_existing_allowlist_fails_closed_when_catalog_grows():
    config = {
        "skills": {
            "allowed": ["grounded-citations", "obsidian"],
            "disabled": ["pdf"],
            "work_profile": {"completed": True},
        }
    }

    changed = reconcile_allowed_skill_catalog(
        config,
        installed_skills={
            "grounded-citations",
            "obsidian",
            "pdf",
            "new-bundled-skill",
        },
    )

    assert changed is True
    assert config["skills"]["allowed"] == ["grounded-citations", "obsidian"]
    assert set(config["skills"]["disabled"]) == {"pdf", "new-bundled-skill"}


def test_legacy_catalog_growth_is_not_silently_migrated():
    config = {"skills": {"disabled": ["pdf"]}}
    original = {"skills": {"disabled": ["pdf"]}}

    changed = reconcile_allowed_skill_catalog(
        config,
        installed_skills=INSTALLED | {"new-bundled-skill"},
    )

    assert changed is False
    assert config == original


def test_local_discovery_auto_selects_only_allowed_and_recommends_the_rest(monkeypatch):
    import socket
    import urllib.request

    monkeypatch.setattr(
        socket,
        "socket",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("network access")),
    )
    monkeypatch.setattr(
        urllib.request,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("network access")),
    )
    config = {
        "skills": {
            "allowed": ["grounded-citations", "obsidian", "docx"],
            "disabled": ["humanizer", "youtube-content"],
            "work_profile": {"completed": True},
        }
    }
    original = {
        "skills": {
            "allowed": ["grounded-citations", "obsidian", "docx"],
            "disabled": ["humanizer", "youtube-content"],
            "work_profile": {"completed": True},
        }
    }

    result = discover_task_skills(
        task="Viết bài có trích dẫn và biên tập nội dung tự nhiên",
        installed_skills={
            "grounded-citations",
            "obsidian",
            "docx",
            "humanizer",
            "youtube-content",
        },
        allowed_skills=config["skills"]["allowed"],
    )

    assert set(result.selected) <= set(config["skills"]["allowed"])
    assert "grounded-citations" in result.selected
    assert "humanizer" in result.recommended
    assert not (set(result.recommended) & set(result.selected))
    assert result.model_attempts == 0
    assert result.used_provider is False
    assert result.used_network is False
    assert config == original
