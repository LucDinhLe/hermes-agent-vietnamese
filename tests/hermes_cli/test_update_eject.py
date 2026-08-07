"""Tests for ``hermes update --eject`` (hermes_cli/update_cmd.py::cmd_update_eject).

A bundled install is a resident desktop bundle: the agent runs out of the
sealed app resources, and its manifest says ``installMode: bundled``. The
eject downloads Hermes Setup from the website and launches it pinned to
the bundle's exact build commit. The tests fake only the two hard process
boundaries — the download and the installer launch — and run everything
else for real.
"""

import json

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

    def fake_launch(setup_path, scratch, commit):
        calls["setup_path"] = setup_path
        calls["commit"] = commit
        return True

    monkeypatch.setattr(update_cmd, "_download_hermes_setup", fake_download)
    monkeypatch.setattr(update_cmd, "_launch_hermes_setup", fake_launch)
    monkeypatch.setattr(update_cmd.sys, "platform", "darwin")
    return calls


class TestEjectResident:
    def test_eject_downloads_setup_and_pins_the_bundle_commit(
        self, bundle_repo, fake_setup, capsys
    ):
        rc = cmd_update_eject(_Args())
        out = capsys.readouterr().out

        assert rc == 0
        # The pin is the bundle's own commit — never the tag, never HEAD.
        assert fake_setup["commit"] == COMMIT
        assert "Hermes-Setup.dmg" in fake_setup["url"]
        assert "hermes-assets.nousresearch.com" in fake_setup["url"]
        assert "Hermes Setup is running" in out

    def test_eject_windows_uses_the_exe(self, bundle_repo, fake_setup, monkeypatch):
        monkeypatch.setattr(update_cmd.sys, "platform", "win32")
        assert cmd_update_eject(_Args()) == 0
        assert fake_setup["url"].endswith("Hermes-Setup.exe")

    def test_eject_refuses_unsupported_platforms(self, bundle_repo, monkeypatch, capsys):
        monkeypatch.setattr(update_cmd.sys, "platform", "linux")
        assert cmd_update_eject(_Args()) == 1
        assert "install.sh" in capsys.readouterr().out

    def test_eject_refuses_without_a_valid_commit(self, bundle_repo, fake_setup, capsys):
        (bundle_repo / ".hermes_build_info.json").write_text(
            json.dumps({"commit": "not-a-sha"})
        )
        assert cmd_update_eject(_Args()) == 1
        assert "commit" in capsys.readouterr().out
        assert "commit" not in fake_setup  # never launched

    def test_eject_skips_when_a_source_checkout_already_exists(
        self, bundle_repo, fake_setup, tmp_path, monkeypatch, capsys
    ):
        import hermes_cli.config as config_mod

        home = tmp_path / "hermes-home"
        target = home / "hermes-agent"
        (target / ".git").mkdir(parents=True)
        monkeypatch.setattr(update_cmd, "get_hermes_home", lambda: home)

        assert cmd_update_eject(_Args()) == 0
        out = capsys.readouterr().out
        assert "already exists" in out
        assert "url" not in fake_setup  # no download

    def test_failed_download_aborts_cleanly(self, bundle_repo, fake_setup, monkeypatch, capsys):
        monkeypatch.setattr(
            update_cmd, "_download_hermes_setup", lambda url, dest: False
        )
        assert cmd_update_eject(_Args()) == 1
        out = capsys.readouterr().out
        assert "unchanged" in out
        # The bundle manifest is untouched: still bundled.
        assert read_install_manifest(bundle_repo).get("installMode") == MODE_BUNDLED


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

    def test_source_install_without_channel_is_a_noop(self, tmp_path, monkeypatch, capsys):
        repo = tmp_path / "src-checkout"
        repo.mkdir()
        write_install_manifest({"installMode": MODE_SOURCE, "channel": "main"}, repo)
        import hermes_cli.main as hermes_main

        monkeypatch.setattr(hermes_main, "PROJECT_ROOT", repo)

        assert cmd_update_eject(_Args()) == 0
        assert "Nothing to eject" in capsys.readouterr().out
