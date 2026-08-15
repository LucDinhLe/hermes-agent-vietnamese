"""Security floors for Node lockfiles scanned by the release OSV workflow."""

from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def _version(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in value.split("-")[0].split("."))


def test_root_lock_has_no_node_tar_below_common_advisory_floor():
    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((REPO_ROOT / "package-lock.json").read_text(encoding="utf-8"))

    assert package["overrides"]["tar"] == "7.5.22"
    resolved = {
        data["version"]
        for path, data in lock["packages"].items()
        if data.get("name") == "tar" or path.endswith("/tar")
    }
    assert resolved, "tar is expected in the Electron build toolchain"
    assert all(_version(item) >= (7, 5, 21) for item in resolved), resolved


def test_website_lock_uses_patched_nanoid_3_line():
    package = json.loads(
        (REPO_ROOT / "website" / "package.json").read_text(encoding="utf-8")
    )
    lock = json.loads(
        (REPO_ROOT / "website" / "package-lock.json").read_text(encoding="utf-8")
    )

    assert package["overrides"]["nanoid"] == "3.3.18"
    vulnerable = [
        (path, data["version"])
        for path, data in lock["packages"].items()
        if (data.get("name") == "nanoid" or path.endswith("/nanoid"))
        and _version(data["version"]) < (3, 3, 18)
    ]
    assert vulnerable == []
