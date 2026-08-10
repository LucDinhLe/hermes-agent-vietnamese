"""detect_install_method derives everything from the running code tree.

No stored method flags: sealed trees carry install-stamp.json (its
``distribution`` field names the steward), git trees are classified by
where they sit — the managed install roots mean ``git``, anywhere else is
``source``. $HERMES_HOME is never consulted, so co-located installs
sharing one data dir (host + Docker gateway) cannot contaminate each
other by construction.
"""
import json

import pytest


def _detect(project_root):
    from hermes_cli.config import detect_install_method

    return detect_install_method(project_root=project_root)


def _write_stamp(root, distribution):
    (root / "install-stamp.json").write_text(
        json.dumps({"schemaVersion": 2, "commit": "a" * 40, "distribution": distribution})
    )


@pytest.mark.parametrize("distribution", ["docker", "nix", "desktop-app"])
def test_sealed_tree_reports_stamp_distribution(tmp_path, distribution):
    _write_stamp(tmp_path, distribution)
    assert _detect(tmp_path) == distribution


def test_unknown_steward_reports_unknown(tmp_path):
    """A newer package manager's stamp value must not leak into consumers."""
    _write_stamp(tmp_path, "snap")
    assert _detect(tmp_path) == "unknown"


def test_bare_tree_is_unknown(tmp_path):
    assert _detect(tmp_path) == "unknown"


def test_git_at_managed_root_is_git(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    checkout = home / "hermes-agent"
    checkout.mkdir(parents=True)
    (checkout / ".git").mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    assert _detect(checkout) == "git"


def test_git_elsewhere_is_source(tmp_path, monkeypatch):
    """A random clone / dev worktree is somebody's working tree, not the
    managed install — `hermes update` refuses it."""
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".hermes"))
    checkout = tmp_path / "src" / "hermes-agent"
    checkout.mkdir(parents=True)
    (checkout / ".git").mkdir()
    assert _detect(checkout) == "source"


def test_worktree_gitfile_is_a_checkout(tmp_path, monkeypatch):
    """A linked worktree's .git is a FILE; it still classifies as a checkout."""
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".hermes"))
    worktree = tmp_path / "wt"
    worktree.mkdir()
    (worktree / ".git").write_text("gitdir: /somewhere/.git/worktrees/wt\n")
    assert _detect(worktree) == "source"


def test_git_wins_over_stray_stamp(tmp_path, monkeypatch):
    """.git means a checkout even if a stamp file is lying around (e.g. a
    dev tree that ran a packaging script)."""
    home = tmp_path / ".hermes"
    checkout = home / "hermes-agent"
    checkout.mkdir(parents=True)
    (checkout / ".git").mkdir()
    _write_stamp(checkout, "docker")
    monkeypatch.setenv("HERMES_HOME", str(home))
    assert _detect(checkout) == "git"


def test_home_scoped_state_is_ignored(tmp_path, monkeypatch):
    """Legacy $HERMES_HOME markers must not influence detection.

    Models the shared-home scenario (host install + Docker gateway
    bind-mounting ~/.hermes): whatever a co-located container left in the
    data dir, this tree's classification only reads this tree.
    """
    home = tmp_path / ".hermes"
    home.mkdir()
    (home / ".install_method").write_text("docker\n")
    monkeypatch.setenv("HERMES_HOME", str(home))
    _write_stamp(tmp_path, "nix")
    assert _detect(tmp_path) == "nix"


def test_every_method_has_update_guidance(tmp_path):
    """Invariant: each derivable method maps to non-empty update guidance."""
    from hermes_cli.config import recommended_update_command_for_method

    for method in ("docker", "nix", "desktop-app", "git", "source", "unknown"):
        assert recommended_update_command_for_method(method).strip()
