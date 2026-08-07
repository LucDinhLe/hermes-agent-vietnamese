import pytest

from scripts.write_install_stamp import build_stamp


def test_build_stamp_keeps_provenance_separate_from_distribution():
    stamp = build_stamp(commit="a" * 40, source="ci", distribution="docker")

    assert stamp["source"] == "ci"
    assert stamp["distribution"] == "docker"


def test_thin_build_carries_no_payload_regardless_of_tag(monkeypatch):
    monkeypatch.delenv("HERMES_DESKTOP_BUNDLED", raising=False)
    monkeypatch.setenv("HERMES_PAYLOAD_TAG", "v9.9.9")

    stamp = build_stamp(commit="a" * 40)

    assert stamp["payload"] is False
    assert stamp["tag"] is None


def test_bundled_build_records_payload_and_tag(monkeypatch):
    monkeypatch.setenv("HERMES_DESKTOP_BUNDLED", "1")
    monkeypatch.setenv("HERMES_PAYLOAD_TAG", "v0.18.0")

    stamp = build_stamp(commit="b" * 40)

    assert stamp["payload"] is True
    assert stamp["tag"] == "v0.18.0"


def test_bundled_build_without_tag_stops_the_build(monkeypatch):
    monkeypatch.setenv("HERMES_DESKTOP_BUNDLED", "1")
    monkeypatch.delenv("HERMES_PAYLOAD_TAG", raising=False)

    with pytest.raises(SystemExit, match="HERMES_PAYLOAD_TAG"):
        build_stamp(commit="b" * 40)
