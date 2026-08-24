"""Credential-sharing behavior for ``profiles.create``.

The desktop's Agent creator distinguishes a shared OAuth pool from an
isolated snapshot.  A named launch profile can itself be reading the root
fallback store, so snapshot mode must copy that effective source instead of
silently leaving the child attached to the shared pool.
"""

from __future__ import annotations

import json

import pytest

import tui_gateway.server as srv


@pytest.fixture
def profile_root(tmp_path, monkeypatch):
    root = tmp_path / "hermes-root"
    launch = root / "profiles" / "main"
    launch.mkdir(parents=True)
    monkeypatch.setenv("HERMES_HOME", str(launch))

    from hermes_cli import profiles

    monkeypatch.setattr(profiles, "seed_profile_skills", lambda *args, **kwargs: {})
    monkeypatch.setattr(profiles, "check_alias_collision", lambda _name: "skip wrapper")
    monkeypatch.setattr(profiles, "_maybe_register_gateway_service", lambda _name: None)
    return root, launch


def _create(name: str, *, share_auth: bool) -> dict:
    envelope = srv._methods["profiles.create"](
        1,
        {
            "name": name,
            "no_skills": True,
            "mirror_credentials": True,
            "share_auth": share_auth,
        },
    )
    assert "error" not in envelope
    return envelope["result"]


def test_isolated_snapshot_copies_effective_global_fallback(profile_root):
    root, launch = profile_root
    payload = {"active_provider": "openai-codex", "providers": {"openai-codex": {"token": "snapshot"}}}
    root_auth = root / "auth.json"
    root_auth.write_text(json.dumps(payload), encoding="utf-8")
    assert not (launch / "auth.json").exists()

    result = _create("researcher", share_auth=False)

    child_auth = root / "profiles" / "researcher" / "auth.json"
    assert json.loads(child_auth.read_text(encoding="utf-8")) == payload
    assert result["mirrored"]["auth"] is True
    assert json.loads(root_auth.read_text(encoding="utf-8")) == payload


def test_isolated_snapshot_prefers_launch_profile_auth(profile_root):
    root, launch = profile_root
    root_auth = {"active_provider": "root"}
    launch_auth = {"active_provider": "profile"}
    (root / "auth.json").write_text(json.dumps(root_auth), encoding="utf-8")
    (launch / "auth.json").write_text(json.dumps(launch_auth), encoding="utf-8")

    result = _create("reviewer", share_auth=False)

    child_auth = root / "profiles" / "reviewer" / "auth.json"
    assert json.loads(child_auth.read_text(encoding="utf-8")) == launch_auth
    assert result["mirrored"]["auth"] is True


def test_shared_mode_keeps_global_pool_without_local_copy(profile_root):
    root, _launch = profile_root
    payload = {"active_provider": "shared"}
    (root / "auth.json").write_text(json.dumps(payload), encoding="utf-8")

    result = _create("planner", share_auth=True)

    assert not (root / "profiles" / "planner" / "auth.json").exists()
    assert result["mirrored"]["auth"] == "shared"


def test_shared_mode_rejects_launch_only_auth_before_creating_profile(profile_root):
    root, launch = profile_root
    (launch / "auth.json").write_text(
        json.dumps({"active_provider": "profile-only"}),
        encoding="utf-8",
    )

    envelope = srv._methods["profiles.create"](
        1,
        {
            "name": "unsafe-shared",
            "no_skills": True,
            "mirror_credentials": True,
            "share_auth": True,
        },
    )

    assert envelope["error"]["code"] == 4063
    assert "shared_auth_pool_unavailable" in envelope["error"]["message"]
    assert not (root / "profiles" / "unsafe-shared").exists()


def test_shared_mode_rejects_forked_private_auth_even_with_global_pool(profile_root):
    root, launch = profile_root
    (root / "auth.json").write_text(
        json.dumps({"active_provider": "root", "providers": {"root": {"token": "shared"}}}),
        encoding="utf-8",
    )
    (launch / "auth.json").write_text(
        json.dumps({"active_provider": "private", "providers": {"private": {"token": "fork"}}}),
        encoding="utf-8",
    )

    envelope = srv._methods["profiles.create"](
        1,
        {
            "name": "forked-shared",
            "no_skills": True,
            "mirror_credentials": True,
            "share_auth": True,
        },
    )

    assert envelope["error"]["code"] == 4063
    assert not (root / "profiles" / "forked-shared").exists()


def test_shared_mode_rejects_read_only_global_credential_pool(profile_root):
    root, _launch = profile_root
    (root / "auth.json").write_text(
        json.dumps(
            {
                "credential_pool": {
                    "openai-codex": [
                        {
                            "id": "manual-oauth",
                            "auth_type": "oauth",
                            "refresh_token": "single-use",
                        }
                    ]
                }
            }
        ),
        encoding="utf-8",
    )

    envelope = srv._methods["profiles.create"](
        1,
        {
            "name": "pool-fork",
            "no_skills": True,
            "mirror_credentials": True,
            "share_auth": True,
        },
    )

    assert envelope["error"]["code"] == 4063
    assert not (root / "profiles" / "pool-fork").exists()


def test_shared_mode_preflight_cannot_be_bypassed_by_disabling_mirroring(profile_root):
    root, _launch = profile_root
    (root / "auth.json").write_text(
        json.dumps(
            {
                "credential_pool": {
                    "openai-codex": [
                        {
                            "id": "rotating-oauth",
                            "access_token": "old-access",
                            "refresh_token": "single-use",
                        }
                    ]
                }
            }
        ),
        encoding="utf-8",
    )

    envelope = srv._methods["profiles.create"](
        1,
        {
            "name": "mirror-bypass",
            "no_skills": True,
            "mirror_credentials": False,
            "share_auth": True,
        },
    )

    assert envelope["error"]["code"] == 4063
    assert not (root / "profiles" / "mirror-bypass").exists()


def test_shared_mode_rejects_clone_all_before_it_can_copy_auth(profile_root):
    root, launch = profile_root
    (launch / "auth.json").write_text(
        json.dumps({"active_provider": "private-clone"}),
        encoding="utf-8",
    )

    envelope = srv._methods["profiles.create"](
        1,
        {
            "name": "clone-all-fork",
            "clone_from": "main",
            "clone_all": True,
            "mirror_credentials": True,
            "share_auth": True,
        },
    )

    assert envelope["error"]["code"] == 4063
    assert not (root / "profiles" / "clone-all-fork").exists()


def test_shared_mode_rejects_spotify_refresh_state_without_source_write_through(profile_root):
    root, _launch = profile_root
    (root / "auth.json").write_text(
        json.dumps(
            {
                "active_provider": "spotify",
                "providers": {
                    "spotify": {
                        "access_token": "expiring",
                        "refresh_token": "rotating",
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    envelope = srv._methods["profiles.create"](
        1,
        {
            "name": "spotify-fork",
            "no_skills": True,
            "mirror_credentials": True,
            "share_auth": True,
        },
    )

    assert envelope["error"]["code"] == 4063
    assert not (root / "profiles" / "spotify-fork").exists()


def test_shared_mode_allows_audited_root_provider_state(profile_root):
    root, _launch = profile_root
    (root / "auth.json").write_text(
        json.dumps(
            {
                "active_provider": "xai-oauth",
                "providers": {
                    "xai-oauth": {
                        "tokens": {
                            "access_token": "shared-access",
                            "refresh_token": "shared-refresh",
                        }
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    result = _create("shared-xai", share_auth=True)

    assert result["mirrored"]["auth"] == "shared"
    assert not (root / "profiles" / "shared-xai" / "auth.json").exists()
