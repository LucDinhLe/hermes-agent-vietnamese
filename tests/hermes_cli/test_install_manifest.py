"""Tests for hermes_cli/install_manifest.py — bundled-install manifest plumbing."""

import json

import pytest

from hermes_cli.install_manifest import (
    CHANNEL_MAIN,
    CHANNEL_STABLE,
    INSTALL_MANIFEST_NAME,
    MODE_BUNDLED,
    MODE_SOURCE,
    STYLE_ADOPTED,
    STYLE_EJECTED,
    format_bundled_update_message,
    install_manifest_path,
    is_bundled_install,
    is_ejected,
    read_install_manifest,
    resolve_update_channel,
    write_install_manifest,
)


def _write_raw(tmp_path, payload):
    (tmp_path / INSTALL_MANIFEST_NAME).write_text(
        payload if isinstance(payload, str) else json.dumps(payload),
        encoding="utf-8",
    )


class TestReadInstallManifest:
    def test_absent_file_means_source_main(self, tmp_path):
        """The back-compat contract: no manifest ⇒ source install on main."""
        manifest = read_install_manifest(tmp_path)
        assert manifest["installMode"] == MODE_SOURCE
        assert manifest["channel"] == CHANNEL_MAIN

    def test_malformed_json_degrades_to_source(self, tmp_path):
        _write_raw(tmp_path, "{not json")
        assert read_install_manifest(tmp_path)["installMode"] == MODE_SOURCE

    def test_non_object_json_degrades_to_source(self, tmp_path):
        _write_raw(tmp_path, '["bundled"]')
        assert read_install_manifest(tmp_path)["installMode"] == MODE_SOURCE

    def test_unknown_mode_degrades_to_source(self, tmp_path):
        """A future vocabulary must not brick an older reader."""
        _write_raw(tmp_path, {"installMode": "quantum", "channel": "stable"})
        manifest = read_install_manifest(tmp_path)
        assert manifest["installMode"] == MODE_SOURCE
        assert manifest["channel"] == CHANNEL_STABLE

    def test_unknown_channel_defaults_by_mode(self, tmp_path):
        _write_raw(tmp_path, {"installMode": "bundled", "channel": "nightly"})
        assert read_install_manifest(tmp_path)["channel"] == CHANNEL_STABLE
        _write_raw(tmp_path, {"installMode": "source", "channel": "nightly"})
        assert read_install_manifest(tmp_path)["channel"] == CHANNEL_MAIN

    def test_extra_keys_preserved(self, tmp_path):
        _write_raw(
            tmp_path,
            {"installMode": "bundled", "channel": "stable", "pinnedTag": "v0.17.0", "futureKey": 7},
        )
        manifest = read_install_manifest(tmp_path)
        assert manifest["pinnedTag"] == "v0.17.0"
        assert manifest["futureKey"] == 7


class TestWriteInstallManifest:
    def test_roundtrip(self, tmp_path):
        write_install_manifest(
            {"installMode": MODE_BUNDLED, "channel": CHANNEL_STABLE, "pinnedTag": "v1.2.3"},
            tmp_path,
        )
        manifest = read_install_manifest(tmp_path)
        assert manifest["installMode"] == MODE_BUNDLED
        assert manifest["pinnedTag"] == "v1.2.3"
        assert manifest["schemaVersion"] == 1

    def test_rejects_invalid_mode(self, tmp_path):
        with pytest.raises(ValueError):
            write_install_manifest({"installMode": "quantum", "channel": "stable"}, tmp_path)
        assert not install_manifest_path(tmp_path).exists()

    def test_rejects_invalid_channel(self, tmp_path):
        with pytest.raises(ValueError):
            write_install_manifest({"installMode": "source", "channel": "nightly"}, tmp_path)

    def test_atomic_no_tmp_leftover(self, tmp_path):
        write_install_manifest({"installMode": MODE_SOURCE, "channel": CHANNEL_MAIN}, tmp_path)
        leftovers = [p.name for p in tmp_path.iterdir() if p.name.endswith(".tmp")]
        assert leftovers == []


class TestIsBundledInstall:
    def test_default_is_not_bundled(self, tmp_path):
        assert not is_bundled_install(tmp_path)

    def test_bundled_manifest_detected(self, tmp_path):
        write_install_manifest({"installMode": MODE_BUNDLED, "channel": CHANNEL_STABLE}, tmp_path)
        assert is_bundled_install(tmp_path)


class TestManageStyle:
    def test_absent_by_default(self, tmp_path):
        assert "manageStyle" not in read_install_manifest(tmp_path)
        assert not is_ejected(tmp_path)

    def test_valid_styles_roundtrip(self, tmp_path):
        for style in (STYLE_ADOPTED, STYLE_EJECTED):
            write_install_manifest(
                {"installMode": MODE_SOURCE, "channel": CHANNEL_MAIN, "manageStyle": style},
                tmp_path,
            )
            assert read_install_manifest(tmp_path)["manageStyle"] == style

    def test_ejected_is_sticky_signal(self, tmp_path):
        write_install_manifest(
            {"installMode": MODE_SOURCE, "channel": CHANNEL_MAIN, "manageStyle": STYLE_EJECTED},
            tmp_path,
        )
        assert is_ejected(tmp_path)

    def test_unknown_style_dropped_not_defaulted(self, tmp_path):
        """A future vocabulary must not wrongly block (or force) adoption."""
        _write_raw(
            tmp_path,
            {"installMode": "source", "channel": "main", "manageStyle": "quantum"},
        )
        assert "manageStyle" not in read_install_manifest(tmp_path)

    def test_eject_smelling_future_style_stays_ejected(self, tmp_path):
        """The opt-out survives vocabulary drift: 'force-ejected' etc. reads as ejected."""
        _write_raw(
            tmp_path,
            {"installMode": "source", "channel": "main", "manageStyle": "force-ejected"},
        )
        assert read_install_manifest(tmp_path)["manageStyle"] == STYLE_EJECTED
        assert is_ejected(tmp_path)

    def test_write_rejects_invalid_style(self, tmp_path):
        with pytest.raises(ValueError):
            write_install_manifest(
                {"installMode": MODE_SOURCE, "channel": CHANNEL_MAIN, "manageStyle": "quantum"},
                tmp_path,
            )


class TestResolveUpdateChannel:
    def test_default_install_is_main(self, tmp_path):
        assert resolve_update_channel(None, tmp_path) == CHANNEL_MAIN

    def test_bundled_is_always_stable_even_with_config_main(self, tmp_path):
        write_install_manifest({"installMode": MODE_BUNDLED, "channel": CHANNEL_STABLE}, tmp_path)
        config = {"update": {"channel": "main"}}
        assert resolve_update_channel(config, tmp_path) == CHANNEL_STABLE

    def test_config_overrides_manifest_on_source(self, tmp_path):
        write_install_manifest({"installMode": MODE_SOURCE, "channel": CHANNEL_MAIN}, tmp_path)
        assert resolve_update_channel({"update": {"channel": "stable"}}, tmp_path) == CHANNEL_STABLE

    def test_config_auto_defers_to_manifest(self, tmp_path):
        write_install_manifest({"installMode": MODE_SOURCE, "channel": CHANNEL_STABLE}, tmp_path)
        assert resolve_update_channel({"update": {"channel": "auto"}}, tmp_path) == CHANNEL_STABLE

    def test_config_garbage_defers_to_manifest(self, tmp_path):
        assert resolve_update_channel({"update": {"channel": 42}}, tmp_path) == CHANNEL_MAIN
        assert resolve_update_channel({"update": "stable"}, tmp_path) == CHANNEL_MAIN


class TestDefaultConfigContract:
    def test_update_channel_key_exists_and_is_valid(self):
        """update.channel must exist in DEFAULT_CONFIG with an accepted value."""
        from hermes_cli.config_defaults import DEFAULT_CONFIG

        channel = DEFAULT_CONFIG["update"]["channel"]
        assert channel in ("auto", CHANNEL_MAIN, CHANNEL_STABLE)


class TestCmdUpdateRefusal:
    def test_cmd_update_refuses_on_bundled(self, monkeypatch, capsys):
        """cmd_update exits 1 with the bundled message before touching git."""
        import hermes_cli.install_manifest as im
        from hermes_cli import main as hermes_main

        monkeypatch.setattr(im, "is_bundled_install", lambda root=None: True)
        # Neutralize the earlier refusal branches so we reach the bundled check.
        monkeypatch.setattr("hermes_cli.config.is_managed", lambda: False)
        monkeypatch.setattr("hermes_cli.config.detect_install_method", lambda root=None: "git")

        class Args:
            check = False
            gateway = False
            branch = None

        with pytest.raises(SystemExit) as excinfo:
            hermes_main.cmd_update(Args())
        assert excinfo.value.code == 1
        out = capsys.readouterr().out
        assert "desktop app" in out
        assert "eject" in out

    def test_message_mentions_in_app_updater(self):
        msg = format_bundled_update_message()
        assert "hermes update" in msg
        assert "eject" in msg
