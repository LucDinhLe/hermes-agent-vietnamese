"""Regression tests for dashboard profile-scoped skills/toolsets management.

"Set as active" on the Profiles page only flips the sticky ``active_profile``
file (future CLI/gateway runs) — it never retargets the running dashboard
process. Before the ``profile`` parameter existed, toggling a skill after
"activating" a profile silently wrote into the dashboard's own config.
These tests pin the new behavior: reads and writes land in the REQUESTED
profile's HERMES_HOME, and the dashboard's own profile stays untouched.
"""
import pytest
import yaml


def _write_skill(skills_dir, name, description="test skill"):
    d = skills_dir / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {description}\n---\n\n# {name}\n",
        encoding="utf-8",
    )


@pytest.fixture
def isolated_profiles(tmp_path, monkeypatch, _isolate_hermes_home):
    """Isolated default home + one named profile, each with its own skills."""
    from hermes_constants import get_hermes_home
    from hermes_cli import profiles

    default_home = get_hermes_home()
    profiles_root = default_home / "profiles"
    worker_home = profiles_root / "worker_alpha"
    for home in (default_home, worker_home):
        (home / "skills").mkdir(parents=True, exist_ok=True)
        (home / "config.yaml").write_text("{}\n", encoding="utf-8")

    _write_skill(default_home / "skills", "dashboard-skill")
    _write_skill(worker_home / "skills", "worker-skill")

    monkeypatch.setattr(profiles, "_get_default_hermes_home", lambda: default_home)
    monkeypatch.setattr(profiles, "_get_profiles_root", lambda: profiles_root)
    return {"default": default_home, "worker_alpha": worker_home}


@pytest.fixture
def client(monkeypatch, isolated_profiles):
    try:
        from starlette.testclient import TestClient
    except ImportError:
        pytest.skip("fastapi/starlette not installed")

    import hermes_state
    from hermes_constants import get_hermes_home
    from hermes_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN

    monkeypatch.setattr(hermes_state, "DEFAULT_DB_PATH", get_hermes_home() / "state.db")
    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


def _load_cfg(home):
    return yaml.safe_load((home / "config.yaml").read_text()) or {}


class TestProfileScopedSkills:


    def test_toggle_writes_into_target_profile_only(self, client, isolated_profiles):
        resp = client.put(
            "/api/skills/toggle",
            json={"name": "worker-skill", "enabled": False, "profile": "worker_alpha"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True, "name": "worker-skill", "enabled": False}

        worker_cfg = _load_cfg(isolated_profiles["worker_alpha"])
        assert "worker-skill" in worker_cfg.get("skills", {}).get("disabled", [])
        # The dashboard's own config must stay untouched — this was the bug.
        default_cfg = _load_cfg(isolated_profiles["default"])
        assert "worker-skill" not in default_cfg.get("skills", {}).get("disabled", [])



    def test_scope_restores_module_globals(self, client, isolated_profiles):
        """The SKILLS_DIR swap is per-request; the module global must be
        restored even after a scoped call (cron-style locked swap)."""
        import tools.skills_tool as skills_tool

        before = skills_tool.SKILLS_DIR
        client.get("/api/skills", params={"profile": "worker_alpha"})
        assert skills_tool.SKILLS_DIR == before

    def test_toggle_updates_work_profile_allowlist_in_target_profile(
        self, client, isolated_profiles
    ):
        worker_home = isolated_profiles["worker_alpha"]
        (worker_home / "config.yaml").write_text(
            yaml.safe_dump(
                {
                    "skills": {
                        "allowed": ["worker-skill"],
                        "disabled": [],
                        "work_profile": {"completed": True, "version": 1},
                    }
                },
                sort_keys=False,
            ),
            encoding="utf-8",
        )

        disabled = client.put(
            "/api/skills/toggle",
            json={"name": "worker-skill", "enabled": False, "profile": "worker_alpha"},
        )
        assert disabled.status_code == 200
        worker_cfg = _load_cfg(worker_home)
        assert worker_cfg["skills"]["allowed"] == []
        assert worker_cfg["skills"]["disabled"] == ["worker-skill"]

        enabled = client.put(
            "/api/skills/toggle",
            json={"name": "worker-skill", "enabled": True, "profile": "worker_alpha"},
        )
        assert enabled.status_code == 200
        worker_cfg = _load_cfg(worker_home)
        assert worker_cfg["skills"]["allowed"] == ["worker-skill"]
        assert worker_cfg["skills"]["disabled"] == []

    def test_work_profile_backend_recommends_applies_and_discovers_locally(
        self, client, isolated_profiles
    ):
        worker_home = isolated_profiles["worker_alpha"]
        for name in (
            "grounded-citations",
            "obsidian",
            "docx",
            "session-librarian",
            "document-to-action-items",
            "humanizer",
        ):
            _write_skill(worker_home / "skills", name)

        before = _load_cfg(worker_home)
        recommendation = client.post(
            "/api/skills/work-profile/recommend",
            json={
                "work_areas": ["research_learning", "writing_content"],
                "common_tasks": ["Nghiên cứu và viết bài có trích dẫn"],
                "profile": "worker_alpha",
            },
        )
        assert recommendation.status_code == 200
        suggested = recommendation.json()
        assert suggested["used_provider"] is False
        assert "grounded-citations" in suggested["skills"]
        assert _load_cfg(worker_home) == before

        applied = client.put(
            "/api/skills/work-profile",
            json={
                "allowed_skills": [
                    "grounded-citations",
                    "obsidian",
                    "docx",
                    "session-librarian",
                ],
                "work_areas": ["research_learning", "writing_content"],
                "common_tasks": ["Nghiên cứu và viết bài có trích dẫn"],
                "skipped": False,
                "profile": "worker_alpha",
            },
        )
        assert applied.status_code == 200
        saved = _load_cfg(worker_home)
        assert saved["skills"]["allowed"] == [
            "docx",
            "grounded-citations",
            "obsidian",
            "session-librarian",
        ]
        assert "humanizer" in saved["skills"]["disabled"]

        discovery = client.post(
            "/api/skills/discover",
            json={
                "task": "Viết bài có trích dẫn và biên tập nội dung tự nhiên",
                "profile": "worker_alpha",
            },
        )
        assert discovery.status_code == 200
        routed = discovery.json()
        assert set(routed["selected"]) <= set(saved["skills"]["allowed"])
        assert "grounded-citations" in routed["selected"]
        assert "humanizer" in routed["recommended"]
        assert routed["model_attempts"] == 0
        assert routed["used_provider"] is False
        assert routed["used_network"] is False
        assert _load_cfg(worker_home) == saved

    def test_work_profile_state_exposes_explicit_fresh_marker_without_mutation(
        self, client, isolated_profiles
    ):
        worker_home = isolated_profiles["worker_alpha"]
        marker = {
            "skills": {
                "work_profile": {
                    "completed": False,
                    "onboarding_required": True,
                    "version": 1,
                }
            }
        }
        (worker_home / "config.yaml").write_text(
            yaml.safe_dump(marker, sort_keys=False), encoding="utf-8"
        )

        response = client.get(
            "/api/skills/work-profile", params={"profile": "worker_alpha"}
        )

        assert response.status_code == 200
        assert response.json()["onboarding_required"] is True
        assert response.json()["legacy"] is False
        assert _load_cfg(worker_home) == marker


class TestProfileScopedHubActions:
    def test_hub_install_spawns_with_profile_flag(
        self, client, isolated_profiles, monkeypatch
    ):
        """Hub installs must go through a fresh ``hermes -p <profile>``
        subprocess — the in-process scope can't reach skills_hub's
        import-time SKILLS_DIR binding."""
        import hermes_cli.web_server as web_server

        calls = []

        class _FakeProc:
            pid = 4242

        def _fake_spawn(subcommand, name):
            calls.append((list(subcommand), name))
            return _FakeProc()

        monkeypatch.setattr(web_server, "_spawn_hermes_action", _fake_spawn)
        resp = client.post(
            "/api/skills/hub/install",
            json={"identifier": "official/demo", "profile": "worker_alpha"},
        )
        assert resp.status_code == 200
        assert calls == [
            (
                ["-p", "worker_alpha", "skills", "install", "official/demo", "--yes"],
                web_server._hub_action_name("install", "official/demo"),
            )
        ]


    def test_hub_install_unknown_profile_404(self, client, isolated_profiles):
        resp = client.post(
            "/api/skills/hub/install",
            json={"identifier": "official/demo", "profile": "ghost"},
        )
        assert resp.status_code == 404
