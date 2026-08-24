"""Tests for ``hermes update --eject`` (hermes_cli/update_cmd.py::cmd_update_eject).

A bundled install is a resident desktop bundle: the agent runs out of the
sealed app resources, and its manifest says ``installMode: bundled``. The
eject downloads the community source installer and launches it pinned to
the bundle's exact build commit. The tests fake only the two hard process
boundaries — the download and the installer launch — and run everything
else for real.
"""

import json
from types import SimpleNamespace

import pytest

import hermes_cli.update_cmd as update_cmd
from hermes_cli.install_manifest import (
    CHANNEL_STABLE,
    MODE_BUNDLED,
    MODE_SOURCE,
    read_install_manifest,
    write_install_manifest,
)
from hermes_cli.update_cmd import cmd_update_eject

COMMIT = "ab" * 20


@pytest.fixture
def bundle_repo(tmp_path, monkeypatch):
    """The payload repo of a resident bundle: manifest + build info."""
    repo = tmp_path / "bundle" / "repo"
    repo.mkdir(parents=True)
    write_install_manifest(
        {
            "installMode": MODE_BUNDLED,
            "channel": CHANNEL_STABLE,
            "manageStyle": "adopted",
            "pinnedTag": "v0.1.0",
        },
        repo,
    )
    (repo / ".hermes_build_info.json").write_text(
        json.dumps({"commit": COMMIT, "tag": "v0.1.0"})
    )
    import hermes_cli.main as hermes_main

    monkeypatch.setattr(hermes_main, "PROJECT_ROOT", repo)
    monkeypatch.setattr(update_cmd, "get_hermes_home", lambda: tmp_path / "home")
    return repo


class _Args:
    def __init__(self, channel=None):
        self.eject = True
        self.channel = channel


@pytest.fixture
def fake_setup(monkeypatch):
    """Fake the download + launch boundary; record what eject asked for."""
    calls = {}

    def fake_download(url, dest):
        calls["url"] = url
        dest.write_bytes(b"fake-installer")
        return True

    def fake_launch(setup_path, scratch, commit, *, platform=None):
        calls["setup_path"] = setup_path
        calls["commit"] = commit
        calls["platform"] = platform
        return True

    monkeypatch.setattr(update_cmd, "_download_eject_installer", fake_download)
    monkeypatch.setattr(update_cmd, "_launch_eject_installer", fake_launch)
    return calls


class TestEjectResident:
    def test_eject_accepts_vietnamese_community_release_tag(
        self, bundle_repo, monkeypatch
    ):
        write_install_manifest(
            {
                "installMode": MODE_BUNDLED,
                "channel": CHANNEL_STABLE,
                "manageStyle": "adopted",
                "pinnedTag": "vi-v0.20.0-28",
            },
            bundle_repo,
        )

        calls = {}

        def fake_eject(project_root, pinned_tag):
            calls["project_root"] = project_root
            calls["pinned_tag"] = pinned_tag
            return 0

        monkeypatch.setattr(update_cmd, "_eject_resident_bundle", fake_eject)

        assert cmd_update_eject(_Args()) == 0
        assert calls == {
            "project_root": bundle_repo,
            "pinned_tag": "vi-v0.20.0-28",
        }

    def test_eject_downloads_source_installer_and_pins_the_bundle_commit(
        self, bundle_repo, fake_setup, capsys
    ):
        rc = update_cmd._eject_resident_bundle(bundle_repo, "v0.1.0", platform="darwin")
        out = capsys.readouterr().out

        assert rc == 0
        # The pin is the bundle's own commit — never the tag, never HEAD.
        assert fake_setup["commit"] == COMMIT
        assert fake_setup["url"].endswith(f"/{COMMIT}/scripts/install.sh")
        assert "LucDinhLe/hermes-agent-vietnamese" in fake_setup["url"]
        assert "source installer is running" in out

    def test_eject_windows_uses_powershell_installer(self, bundle_repo, fake_setup):
        assert (
            update_cmd._eject_resident_bundle(bundle_repo, "v0.1.0", platform="win32")
            == 0
        )
        assert fake_setup["url"].endswith(f"/{COMMIT}/scripts/install.ps1")

    def test_eject_refuses_unsupported_platforms(self, bundle_repo, capsys):
        assert (
            update_cmd._eject_resident_bundle(bundle_repo, "v0.1.0", platform="linux")
            == 1
        )
        assert "install.sh" in capsys.readouterr().out

    def test_eject_refuses_without_a_valid_commit(
        self, bundle_repo, fake_setup, capsys
    ):
        (bundle_repo / ".hermes_build_info.json").write_text(
            json.dumps({"commit": "not-a-sha"})
        )
        assert (
            update_cmd._eject_resident_bundle(bundle_repo, "v0.1.0", platform="darwin")
            == 1
        )
        assert "commit" in capsys.readouterr().out
        assert "commit" not in fake_setup  # never launched

    def test_eject_skips_when_a_source_checkout_already_exists(
        self, bundle_repo, fake_setup, tmp_path, monkeypatch, capsys
    ):
        home = tmp_path / "hermes-home"
        target = home / "hermes-agent"
        (target / ".git").mkdir(parents=True)
        monkeypatch.setattr(update_cmd, "get_hermes_home", lambda: home)

        assert (
            update_cmd._eject_resident_bundle(bundle_repo, "v0.1.0", platform="darwin")
            == 0
        )
        out = capsys.readouterr().out
        assert "already exists" in out
        assert "url" not in fake_setup  # no download

    def test_failed_download_aborts_cleanly(
        self, bundle_repo, fake_setup, monkeypatch, capsys
    ):
        monkeypatch.setattr(
            update_cmd, "_download_eject_installer", lambda url, dest: False
        )
        assert (
            update_cmd._eject_resident_bundle(bundle_repo, "v0.1.0", platform="darwin")
            == 1
        )
        out = capsys.readouterr().out
        assert "unchanged" in out
        # The bundle manifest is untouched: still bundled.
        assert read_install_manifest(bundle_repo).get("installMode") == MODE_BUNDLED


class TestEjectLauncher:
    def test_windows_launcher_runs_community_script_at_exact_commit(
        self, tmp_path, monkeypatch
    ):
        installer = tmp_path / "install.ps1"
        installer.write_text("# test")
        calls = {}

        monkeypatch.setattr(update_cmd.shutil, "which", lambda name: "powershell.exe")

        def fake_popen(argv, **kwargs):
            calls["argv"] = argv
            calls["kwargs"] = kwargs
            return SimpleNamespace()

        monkeypatch.setattr(update_cmd.subprocess, "Popen", fake_popen)

        assert update_cmd._launch_eject_installer(
            installer, tmp_path, COMMIT, platform="win32"
        )
        commit_arg = calls["argv"].index("-Commit")
        assert calls["argv"][commit_arg:] == [
            "-Commit",
            COMMIT,
            "-ForceCommit",
            "-IncludeDesktop",
        ]
        assert calls["argv"][calls["argv"].index("-File") + 1] == str(installer)

    def test_macos_launcher_quotes_paths_and_pins_exact_commit(
        self, tmp_path, monkeypatch
    ):
        installer = tmp_path / "folder with spaces" / "install.sh"
        installer.parent.mkdir()
        installer.write_text("#!/bin/bash\n")
        calls = {}

        def fake_run(argv, **kwargs):
            calls["argv"] = argv
            return SimpleNamespace(returncode=0, stderr="")

        monkeypatch.setattr(update_cmd.subprocess, "run", fake_run)

        assert update_cmd._launch_eject_installer(
            installer, tmp_path, COMMIT, platform="darwin"
        )
        launcher = tmp_path / "Hermes Source Install.command"
        source = launcher.read_text(encoding="utf-8")
        assert calls["argv"] == ["open", "-n", str(launcher)]
        assert str(installer) in source
        assert f"--commit {COMMIT}" in source
        assert "--force-commit --include-desktop" in source


class TestEjectSourceManaged:
    def test_source_install_with_channel_switches_channel_only(
        self, tmp_path, monkeypatch, capsys
    ):
        repo = tmp_path / "src-checkout"
        repo.mkdir()
        write_install_manifest({"installMode": MODE_SOURCE, "channel": "main"}, repo)
        import hermes_cli.main as hermes_main

        monkeypatch.setattr(hermes_main, "PROJECT_ROOT", repo)

        assert cmd_update_eject(_Args(channel="stable")) == 0
        manifest = read_install_manifest(repo)
        assert manifest["channel"] == "stable"
        assert manifest["installMode"] == MODE_SOURCE

    def test_source_install_without_channel_is_a_noop(
        self, tmp_path, monkeypatch, capsys
    ):
        repo = tmp_path / "src-checkout"
        repo.mkdir()
        write_install_manifest({"installMode": MODE_SOURCE, "channel": "main"}, repo)
        import hermes_cli.main as hermes_main

        monkeypatch.setattr(hermes_main, "PROJECT_ROOT", repo)

        assert cmd_update_eject(_Args()) == 0
        assert "Nothing to eject" in capsys.readouterr().out
