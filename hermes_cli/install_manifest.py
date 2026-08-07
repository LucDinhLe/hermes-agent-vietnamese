"""Install-manifest functions for bundled desktop installs.

``.hermes-install.json`` is a small marker file next to the managed checkout.
It sits in the parent directory of ``hermes_cli/``. This is the same anchor
rule as ``.install_method`` in ``hermes_cli/config.py``. The marker describes
the running code, not ``$HERMES_HOME``. Two installs that share one data
directory cannot overwrite each other's marker.

The file records where a checkout came from and where its updates come from:

    {
      "schemaVersion": 1,
      "installMode": "bundled" | "source",
      "channel": "stable" | "main",
      "manageStyle": "adopted" | "ejected",  # optional
      "pinnedCommit": "<sha>",       # optional
      "pinnedTag": "v0.17.0"         # optional, bundled installs only
    }

Semantics
---------
* ``installMode: "source"`` — the user manages the checkout. ``hermes update``
  owns updates (git pull, tag checkout, or ZIP fallback). **A missing file
  means source mode.** Every install that exists today is a source install.
  No migration is necessary.
* ``installMode: "bundled"`` — the checkout came from payloads inside the
  desktop installer. The desktop app owns updates. It rebuilds the checkout
  offline after the app updates itself. ``hermes update`` refuses and points
  at the in-app updater.
* ``channel`` — ``"main"`` follows the git main branch (source mode only).
  ``"stable"`` follows tagged releases. :func:`resolve_update_channel` gives
  the effective channel. ``update.channel`` in config.yaml can override the
  channel for source installs. Bundled installs are always stable.
* ``manageStyle`` — how the install got into its current mode.
  ``installMode`` says where it is now. Values:

  - ``"adopted"`` — the install is desktop-managed (a resident bundle's
    static manifest, or an installer run that selected bundled mode).
  - ``"ejected"`` — the user ran ``hermes update --eject``. This opt-out is
    permanent, although the resulting ``installMode`` is ``"source"``.
  - missing — a legacy checkout from before manifests, or a plain source
    install.

This is a pure-stdlib leaf module. It does not import hermes_cli.config.
A config import would pull the full config machinery into every consumer.
The desktop bootstrap and the install scripts also write this file without
Python.
"""

import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

INSTALL_MANIFEST_NAME = ".hermes-install.json"
INSTALL_MANIFEST_SCHEMA_VERSION = 1

MODE_SOURCE = "source"
MODE_BUNDLED = "bundled"
_VALID_MODES = (MODE_SOURCE, MODE_BUNDLED)

CHANNEL_MAIN = "main"
CHANNEL_STABLE = "stable"
_VALID_CHANNELS = (CHANNEL_MAIN, CHANNEL_STABLE)

STYLE_ADOPTED = "adopted"
STYLE_EJECTED = "ejected"
_VALID_STYLES = (STYLE_ADOPTED, STYLE_EJECTED)


def _default_manifest() -> dict:
    """The implicit manifest for a checkout with no ``.hermes-install.json``.

    Source mode on the main channel. This is the current behavior, so
    installs from before manifests do not change.
    """
    return {
        "schemaVersion": INSTALL_MANIFEST_SCHEMA_VERSION,
        "installMode": MODE_SOURCE,
        "channel": CHANNEL_MAIN,
    }


def install_manifest_path(project_root: Optional[Path] = None) -> Path:
    """Path of the manifest for the running code's install tree."""
    root = project_root if project_root is not None else Path(__file__).parent.parent
    return Path(root).resolve() / INSTALL_MANIFEST_NAME


def read_install_manifest(project_root: Optional[Path] = None) -> dict:
    """Read the install manifest and correct bad values.

    This function does not raise errors. A missing, unreadable, or malformed
    file falls back to the source/main default. Unknown ``installMode`` or
    ``channel`` values (for example, from a future Hermes with more values)
    also fall back. This keeps the update logic safe. The function keeps
    unknown extra keys, so a round trip of a future manifest does not remove
    fields.
    """
    path = install_manifest_path(project_root)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return _default_manifest()
    except (OSError, ValueError) as exc:
        logger.warning("Unreadable install manifest at %s (%s); assuming source install", path, exc)
        return _default_manifest()

    if not isinstance(raw, dict):
        logger.warning("Install manifest at %s is not a JSON object; assuming source install", path)
        return _default_manifest()

    manifest = dict(raw)
    if manifest.get("installMode") not in _VALID_MODES:
        manifest["installMode"] = MODE_SOURCE
    if manifest.get("channel") not in _VALID_CHANNELS:
        manifest["channel"] = CHANNEL_MAIN if manifest["installMode"] == MODE_SOURCE else CHANNEL_STABLE
    # Drop unknown manageStyle values. Do not replace them with a default.
    # A missing style means "adoption can examine this checkout". An invented
    # style can block adoption in error, or worse, remove an eject opt-out
    # that a future vocabulary wrote. Exception: a value that contains
    # "eject" stays ejected. The opt-out must survive vocabulary changes in
    # both directions.
    style = manifest.get("manageStyle")
    if style is not None and style not in _VALID_STYLES:
        if isinstance(style, str) and "eject" in style.lower():
            manifest["manageStyle"] = STYLE_EJECTED
        else:
            del manifest["manageStyle"]
    manifest.setdefault("schemaVersion", INSTALL_MANIFEST_SCHEMA_VERSION)
    return manifest


def write_install_manifest(
    manifest: dict,
    project_root: Optional[Path] = None,
) -> Path:
    """Write the manifest atomically (tmp file + rename). Return the path.

    The function validates mode, channel, and style before the write. A bad
    write is worse than an error: every reader silently converts bad values
    to source/main, and the caller's intent (for example, to mark an install
    bundled) is lost without a signal.
    """
    if manifest.get("installMode") not in _VALID_MODES:
        raise ValueError(f"invalid installMode: {manifest.get('installMode')!r}")
    if manifest.get("channel") not in _VALID_CHANNELS:
        raise ValueError(f"invalid channel: {manifest.get('channel')!r}")
    if manifest.get("manageStyle") is not None and manifest["manageStyle"] not in _VALID_STYLES:
        raise ValueError(f"invalid manageStyle: {manifest.get('manageStyle')!r}")

    payload = dict(manifest)
    payload.setdefault("schemaVersion", INSTALL_MANIFEST_SCHEMA_VERSION)

    path = install_manifest_path(project_root)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)
    return path


def is_bundled_install(project_root: Optional[Path] = None) -> bool:
    """True when the running checkout came from desktop payloads."""
    return read_install_manifest(project_root).get("installMode") == MODE_BUNDLED


def is_ejected(project_root: Optional[Path] = None) -> bool:
    """True when the user ejected this checkout from desktop management.

    This is the permanent opt-out signal for auto-adoption. Auto-adoption
    must not move an ejected checkout back into the bundled path, although
    its ``installMode`` is ``source``.
    """
    return read_install_manifest(project_root).get("manageStyle") == STYLE_EJECTED


def resolve_update_channel(
    config: Optional[dict] = None,
    project_root: Optional[Path] = None,
) -> str:
    """Give the effective update channel for this install.

    Resolution order:
    1. Bundled installs are always ``stable``. The desktop app rebuilds the
       checkout from tagged release payloads. A config override cannot change
       what the installer ships. Eject first to change this.
    2. ``update.channel`` from config.yaml, when it is ``stable`` or ``main``.
       The values ``auto``, empty, and unknown fall through.
    3. The channel from the manifest. The source default is ``main``.
    """
    manifest = read_install_manifest(project_root)
    if manifest.get("installMode") == MODE_BUNDLED:
        return CHANNEL_STABLE

    configured: Any = None
    if isinstance(config, dict):
        update_cfg = config.get("update")
        if isinstance(update_cfg, dict):
            configured = update_cfg.get("channel")
    if isinstance(configured, str) and configured.strip().lower() in _VALID_CHANNELS:
        return configured.strip().lower()

    return manifest.get("channel", CHANNEL_MAIN)


def format_bundled_update_message() -> str:
    """Refusal text for ``hermes update`` on a bundled install."""
    return (
        "✗ The Hermes desktop app manages this Hermes install.\n"
        "\n"
        "The desktop app updates the agent together with itself. Use the\n"
        "in-app updater (Settings → Check for updates), not `hermes update`.\n"
        "\n"
        "If you want to manage this checkout yourself with `hermes update`,\n"
        "eject it from desktop management first. After an eject, the desktop\n"
        "app continues to update itself, but the agent checkout is yours."
    )
