import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_RELEASE = json.loads(
    (REPO_ROOT / ".github/public-release.json").read_text(encoding="utf-8")
)


def _read(path: str) -> str:
    return (REPO_ROOT / path).read_text(encoding="utf-8")


def test_primary_download_guides_only_point_to_current_release() -> None:
    current_release = PUBLIC_RELEASE["tag"]
    rollback_release = PUBLIC_RELEASE["rollbackTag"]
    for path in (
        "README.md",
        "README.vi.md",
        "docs/cai-dat-windows-bang-anh.md",
    ):
        text = _read(path)
        assert current_release in text, f"{path} must name {current_release}"
        assert rollback_release not in text, (
            f"{path} still sends users to {rollback_release}"
        )


def test_download_tables_use_current_release_and_exact_asset_names() -> None:
    current_release = PUBLIC_RELEASE["tag"]
    prefix = (
        "https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/"
        f"{current_release}/"
    )
    for path in ("README.md", "README.vi.md", ".github/release-notes-vietnamese.md"):
        text = _read(path)
        for filename in PUBLIC_RELEASE["downloadFiles"]:
            assert prefix + filename in text, (
                f"{path} is missing the current URL for {filename}"
            )


def test_release_notes_identify_current_default_and_rollback() -> None:
    text = _read(".github/release-notes-vietnamese.md")
    assert "bản tải mặc định/Latest" in text
    assert PUBLIC_RELEASE["tag"] in text
    assert f"{PUBLIC_RELEASE['rollbackTag']}) được giữ nguyên làm bản quay lui" in text
    assert "Bản ổn định/Latest vẫn là" not in text


def test_windows_guide_matches_published_x64_identity() -> None:
    text = _read("docs/cai-dat-windows-bang-anh.md")
    windows_x64 = PUBLIC_RELEASE["windowsX64"]
    assert f"{windows_x64['size']:,}".replace(",", ".") in text
    assert windows_x64["sha256"] in text
