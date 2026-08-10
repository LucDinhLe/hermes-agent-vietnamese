"""Read-only-install guard in :func:`tools.lazy_deps.ensure` (#48628).

A read-only site-packages (any nix build — the venv lives in the
immutable store) cannot receive lazy pip installs: the uv -> pip ->
ensurepip ladder burns ~15s bootstrapping ensurepip only to fail.
``ensure()`` probes writability directly and must fail fast instead —
no install-method inference involved.
"""

import pytest

from tools import lazy_deps
from tools.lazy_deps import FeatureUnavailable


FEATURE = "provider.anthropic"


@pytest.fixture(autouse=True)
def _missing_and_installable(monkeypatch):
    """Reach the guard: deps missing, installs allowed, no durable target.

    ``_allow_lazy_installs`` is patched explicitly so the suite does not
    depend on the host's ~/.hermes/config.yaml (a local
    ``allow_lazy_installs: false`` otherwise short-circuits with a different
    rejection reason).
    """
    monkeypatch.setattr(lazy_deps, "feature_missing", lambda _f: ("some-pkg==1.0",))
    monkeypatch.setattr(lazy_deps, "_allow_lazy_installs", lambda: True)
    monkeypatch.setattr(lazy_deps, "_lazy_install_target", lambda: None)


def _no_installer(monkeypatch):
    """Fail loudly if the guard lets execution reach the install ladder."""
    def _boom(*_a, **_kw):
        raise AssertionError("guard let execution reach the install ladder")

    monkeypatch.setattr(lazy_deps.subprocess, "run", _boom)


def test_readonly_install_fails_fast_without_touching_the_installer(monkeypatch):
    monkeypatch.setattr(lazy_deps, "_site_packages_writable", lambda: False)
    _no_installer(monkeypatch)

    with pytest.raises(FeatureUnavailable) as excinfo:
        lazy_deps.ensure(FEATURE, prompt=False)

    assert "read-only" in excinfo.value.reason
    # refresh_active_features classifies by this prefix — anything else is
    # reported to the user as a hard failure instead of a skip.
    assert excinfo.value.reason.startswith("unsupported ")


def test_reason_is_classified_as_skipped_not_failed(monkeypatch):
    """The wording contract with refresh_active_features, pinned directly."""
    monkeypatch.setattr(lazy_deps, "_site_packages_writable", lambda: False)

    with pytest.raises(FeatureUnavailable) as excinfo:
        lazy_deps.ensure(FEATURE, prompt=False)

    assert excinfo.value.reason.startswith("unsupported "), (
        "refresh_active_features would report this as failed: rather than skipped:"
    )


def test_writable_install_is_not_blocked_by_the_guard(monkeypatch):
    """On a normal writable venv the guard must be transparent."""
    monkeypatch.setattr(lazy_deps, "_site_packages_writable", lambda: True)

    with pytest.raises(FeatureUnavailable) as excinfo:
        lazy_deps.ensure(FEATURE, prompt=False)

    # Whatever stops the install here, it must NOT be the read-only guard.
    assert "read-only installs" not in excinfo.value.reason


def test_durable_install_target_overrides_the_guard(monkeypatch, tmp_path):
    """A configured writable target means lazy installs legitimately work.

    Dockerfile and the NixOS container module set
    HERMES_LAZY_INSTALL_TARGET; blocking there would break that deployment
    even though the venv itself is sealed.
    """
    monkeypatch.setattr(lazy_deps, "_site_packages_writable", lambda: False)
    monkeypatch.setattr(lazy_deps, "_lazy_install_target", lambda: tmp_path)

    with pytest.raises(FeatureUnavailable) as excinfo:
        lazy_deps.ensure(FEATURE, prompt=False)

    assert "read-only installs" not in excinfo.value.reason, (
        "durable-target installs must not be blocked by the read-only guard"
    )


def test_platform_unsupported_takes_precedence(monkeypatch):
    """A platform-specific reason is more actionable than 'read-only install'.

    Also required for consistency: refresh_active_features pre-checks
    _unsupported_feature_reason before calling ensure().
    """
    monkeypatch.setattr(lazy_deps, "_site_packages_writable", lambda: False)
    monkeypatch.setattr(
        lazy_deps, "_unsupported_feature_reason", lambda _f: "unsupported on win32"
    )

    with pytest.raises(FeatureUnavailable) as excinfo:
        lazy_deps.ensure(FEATURE, prompt=False)

    assert excinfo.value.reason == "unsupported on win32"


def test_probe_errs_toward_writable(monkeypatch):
    """A broken probe must not block installs on a normal venv.

    _site_packages_writable itself returns True when sysconfig/os.access
    misbehave; the install ladder reports real write failures with context.
    """
    import sysconfig

    def _raise(*_a, **_kw):
        raise OSError("probe broke")

    monkeypatch.setattr(sysconfig, "get_paths", _raise)

    assert lazy_deps._site_packages_writable() is True
