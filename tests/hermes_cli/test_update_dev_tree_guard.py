"""`hermes update` refuses non-managed git checkouts outright.

A .git tree outside the managed install roots is somebody's working
tree (install method "source"). The update flow would stash local
changes and move the checkout to the update branch — so cmd_update
refuses up front and points at `git pull`, before any git mutation.
These tests build real git checkouts and assert the tree afterward.
"""

import subprocess

import pytest

import hermes_cli.main as hermes_main


def _git(cwd, *args):
    result = subprocess.run(
        ["git", "-C", str(cwd), *args],
        capture_output=True, text=True, encoding="utf-8",
    )
    assert result.returncode == 0, f"git {args} failed: {result.stderr}"
    return result.stdout.strip()


def _make_checkout(repo):
    repo.mkdir(parents=True)
    _git(repo, "init", "-b", "main")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "test")
    (repo / "f.txt").write_text("original\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "initial")


@pytest.fixture
def dev_checkout(tmp_path, monkeypatch):
    """A real git checkout on a feature branch with a dirty file."""
    # Keep the managed root elsewhere so this checkout is off-path.
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".hermes"))
    repo = tmp_path / "src" / "hermes-agent"
    _make_checkout(repo)
    _git(repo, "checkout", "-b", "feature/x")
    (repo / "f.txt").write_text("uncommitted work\n")
    return repo


class _Args:
    yes = False
    branch = None
    force = False
    force_venv = False
    check = False
    eject = False
    gateway = False


def _patch_project_root(monkeypatch, root):
    monkeypatch.setattr(hermes_main, "PROJECT_ROOT", root)


class TestSourceCheckoutRefusal:
    def test_update_refuses_and_leaves_the_tree_alone(
        self, dev_checkout, monkeypatch, capsys
    ):
        _patch_project_root(monkeypatch, dev_checkout)

        with pytest.raises(SystemExit) as exc:
            hermes_main.cmd_update(_Args())

        assert exc.value.code == 1
        out = capsys.readouterr().out
        assert "not the managed install" in out
        assert "git pull" in out
        # The tree is untouched: same branch, same dirty content, no stash.
        assert _git(dev_checkout, "rev-parse", "--abbrev-ref", "HEAD") == "feature/x"
        assert (dev_checkout / "f.txt").read_text() == "uncommitted work\n"
        assert _git(dev_checkout, "stash", "list") == ""

    def test_yes_does_not_override(self, dev_checkout, monkeypatch, capsys):
        """A source checkout is not `hermes update`'s job — --yes is not a
        bypass. Use git."""
        _patch_project_root(monkeypatch, dev_checkout)
        args = _Args()
        args.yes = True

        with pytest.raises(SystemExit) as exc:
            hermes_main.cmd_update(args)

        assert exc.value.code == 1
        assert _git(dev_checkout, "rev-parse", "--abbrev-ref", "HEAD") == "feature/x"

    def test_check_also_refuses(self, dev_checkout, monkeypatch, capsys):
        _patch_project_root(monkeypatch, dev_checkout)
        args = _Args()
        args.check = True

        with pytest.raises(SystemExit) as exc:
            hermes_main.cmd_update(args)

        assert exc.value.code == 1

    def test_managed_root_proceeds(self, tmp_path, monkeypatch, capsys):
        home = tmp_path / ".hermes"
        monkeypatch.setenv("HERMES_HOME", str(home))
        repo = home / "hermes-agent"
        _make_checkout(repo)
        _patch_project_root(monkeypatch, repo)

        # Stop the update right after the refusal gates: the pre-update
        # backup is the first mutating step. Raising there proves the
        # managed checkout passed the gates without running a real update.
        import hermes_cli.update_cmd as update_cmd

        sentinel = RuntimeError("past-the-gates")

        def _boom(_args):
            raise sentinel

        monkeypatch.setattr(update_cmd._m(), "_run_pre_update_backup", _boom)

        with pytest.raises(RuntimeError, match="past-the-gates"):
            hermes_main.cmd_update(_Args())

        assert "not the managed install" not in capsys.readouterr().out
