import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_RELEASE = json.loads(
    (REPO_ROOT / ".github/public-release.json").read_text(encoding="utf-8")
)
CANDIDATE_RELEASE = "vi-v0.32.1-8"


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
        assert "vi-v0.31.0-7" not in text, f"{path} still promotes superseded v31"


def test_download_tables_use_current_release_and_exact_asset_names() -> None:
    current_release = PUBLIC_RELEASE["tag"]
    prefix = (
        "https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/"
        f"{current_release}/"
    )
    for path in ("README.md", "README.vi.md"):
        text = _read(path)
        for filename in PUBLIC_RELEASE["downloadFiles"]:
            assert prefix + filename in text, (
                f"{path} is missing the current URL for {filename}"
            )


def test_candidate_notes_describe_v321_without_relabeling_current_public() -> None:
    """Candidate notes may advance before the public release descriptor does."""
    text = _read(".github/release-notes-vietnamese.md")
    assert CANDIDATE_RELEASE in text
    assert PUBLIC_RELEASE["tag"] in text
    assert "community-prerelease, chưa phải stable" in text
    assert "Authenticode `NotSigned`" in text
    assert "an toàn phiên/dự án" in text


def test_v32_relabels_the_default_release_without_claiming_stable() -> None:
    text = _read(".github/release-notes-vietnamese.md")
    assert "GitHub Latest" in text
    assert "chưa phải stable" in text
    assert "Latest đầy đủ vẫn là v31" not in text


def test_latest_v32_requires_a_public_readme_callout() -> None:
    release_url = (
        "https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/"
        f"{PUBLIC_RELEASE['tag']}"
    )
    download_prefix = (
        "https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/"
        f"{PUBLIC_RELEASE['tag']}/"
    )

    for path in ("README.md", "README.vi.md"):
        text = _read(path)
        assert PUBLIC_RELEASE["tag"] in text, f"{path} must feature v32 Latest"
        assert "community pilot" in text.lower()
        assert "chưa phải stable" in text.lower()
        assert release_url in text, f"{path} must link to the v32 release page"
        for filename in PUBLIC_RELEASE["downloadFiles"]:
            assert download_prefix + filename in text, (
                f"{path} is missing the v32 URL for {filename}"
            )


def test_windows_guide_matches_published_x64_identity() -> None:
    text = _read("docs/cai-dat-windows-bang-anh.md")
    windows_x64 = PUBLIC_RELEASE["windowsX64"]
    assert f"{windows_x64['size']:,}".replace(",", ".") in text
    assert windows_x64["sha256"] in text


def test_windows_warning_images_are_published_and_referenced() -> None:
    image_dir = REPO_ROOT / "docs/assets/windows-install"
    required_docs = (
        "README.vi.md",
        "docs/cai-dat-windows-bang-anh.md",
    )
    for filename in PUBLIC_RELEASE["windowsInstallImages"]:
        image = image_dir / filename
        assert image.is_file() and image.stat().st_size > 0, (
            f"missing Windows installation image: {filename}"
        )
        for path in required_docs:
            assert filename in _read(path), f"{path} must reference {filename}"


def test_public_introduction_does_not_duplicate_v25_changelog() -> None:
    default_readme = _read("README.md")
    candidate_notes = _read(".github/release-notes-vietnamese.md")
    assert "Cải thiện trong bản v25" not in default_readme
    assert "Cải thiện trong bản v25" not in candidate_notes
    assert "Điểm mạnh so với cách tự cài Hermes Agent từ mã nguồn" in default_readme
