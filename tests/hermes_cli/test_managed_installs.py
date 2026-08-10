from types import SimpleNamespace
from unittest.mock import patch

from hermes_cli.config import recommended_update_command
from hermes_cli.main import cmd_update
from tools.skills_hub import OptionalSkillSource


def test_recommended_update_command_defaults_to_hermes_update(monkeypatch):
    monkeypatch.delenv("HERMES_MANAGED", raising=False)

    with patch("hermes_cli.config.detect_install_method", return_value="git"):
        assert recommended_update_command() == "hermes update"


def test_optional_skill_source_honors_env_override(monkeypatch, tmp_path):
    optional_dir = tmp_path / "optional-skills"
    optional_dir.mkdir()
    monkeypatch.setenv("HERMES_OPTIONAL_SKILLS", str(optional_dir))

    source = OptionalSkillSource()

    assert source._optional_dir == optional_dir
