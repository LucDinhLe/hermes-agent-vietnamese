"""Offline contract for the Node runtime used by v32 release surfaces."""

from __future__ import annotations

import json
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
NODE_FLOOR_MAJOR = 26
NODE_FLOOR_RANGE = ">=26.0.0"


def _read(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def _json(relative_path: str) -> dict:
    return json.loads(_read(relative_path))


def test_manifests_and_lockfile_share_node_26_floor() -> None:
    root_manifest = _json("package.json")
    desktop_manifest = _json("apps/desktop/package.json")
    lockfile = _json("package-lock.json")

    assert root_manifest["engines"]["node"] == NODE_FLOOR_RANGE
    assert desktop_manifest["engines"]["node"] == NODE_FLOOR_RANGE
    assert lockfile["packages"][""]["engines"]["node"] == NODE_FLOOR_RANGE
    assert lockfile["packages"]["apps/desktop"]["engines"]["node"] == NODE_FLOOR_RANGE


def test_posix_installer_provisions_and_accepts_only_node_26_or_newer() -> None:
    installer = _read("scripts/install.sh")
    gate = installer.split("node_satisfies_build() {", 1)[1].split(
        "# npm 11.10.0", 1
    )[0]

    assert f'NODE_VERSION="{NODE_FLOOR_MAJOR}"' in installer
    assert f'[ "$major" -ge {NODE_FLOOR_MAJOR} ]' in gate
    assert "-ge 22" not in gate


def test_windows_installer_provisions_and_accepts_only_node_26_or_newer() -> None:
    installer = _read("scripts/install.ps1")
    gate = installer.split("function Test-NodeVersionOk {", 1)[1].split(
        "function Test-Node {", 1
    )[0]

    assert f'$NodeVersion = "{NODE_FLOOR_MAJOR}"' in installer
    assert f"$v.Major -ge {NODE_FLOOR_MAJOR}" in gate
    assert "$v.Major -eq 22" not in gate


def test_shared_bootstrap_defaults_to_node_26_for_acceptance_and_install() -> None:
    bootstrap = _read("scripts/lib/node-bootstrap.sh")

    assert (
        'HERMES_NODE_MIN_VERSION="${HERMES_NODE_MIN_VERSION:-26}"'
        in bootstrap
    )
    assert (
        'HERMES_NODE_TARGET_MAJOR="${HERMES_NODE_TARGET_MAJOR:-26}"'
        in bootstrap
    )


def test_python_managed_node_healer_defaults_to_node_26() -> None:
    constants = _read("hermes_constants.py")

    assert (
        '_HERMES_NODE_TARGET_MAJOR = int(os.environ.get('
        '"HERMES_NODE_TARGET_MAJOR", "26"))'
    ) in constants
    assert '"HERMES_NODE_TARGET_MAJOR", "22"' not in constants


def test_vietnamese_release_workflow_uses_node_26() -> None:
    workflow = _read(".github/workflows/release-vietnamese.yml")
    configured_majors = re.findall(r"node-version:\s*['\"]?(\d+)", workflow)

    assert configured_majors, "release workflow has no setup-node runtime"
    assert set(configured_majors) == {str(NODE_FLOOR_MAJOR)}


def test_nix_surfaces_provision_node_26_and_invalidate_node_22_state() -> None:
    module = _read("nix/nixosModules.nix")
    sandbox = _read("nix/sandbox.nix")

    assert "https://deb.nodesource.com/node_26.x" in module
    assert "/var/lib/hermes-tools-provisioned-node26" in module
    assert "schema = 5;" in module
    assert "node_22.x" not in module
    assert "nodejs_26" in sandbox
    assert "nodejs_22" not in sandbox
