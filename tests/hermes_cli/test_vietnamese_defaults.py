"""Community-distribution defaults that must survive upstream syncs."""

from hermes_cli.config_defaults import DEFAULT_CONFIG


def test_fresh_profile_defaults_to_vietnamese_interface():
    assert DEFAULT_CONFIG["display"]["language"] == "vi"
