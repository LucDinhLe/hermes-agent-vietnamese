"""Tests for the stable update channel (tag-tracking) in hermes_cli/update_cmd.py."""

from types import SimpleNamespace
from unittest.mock import patch

from hermes_cli.update_cmd import (
    _latest_public_release_tag_from_releases,
    _latest_release_tag_from_ls_remote,
    _parse_release_tag,
    _resolve_latest_release_tag,
    _stable_channel_active,
)


class TestParseReleaseTag:
    def test_final_releases_parse(self):
        assert _parse_release_tag("v0.17.0") == (0, 17, 0, -1)
        assert _parse_release_tag("vi-v0.20.0-15") == (0, 20, 0, 15)
        assert _parse_release_tag("v10.2.33") == (10, 2, 33, -1)
        assert _parse_release_tag(" v1.2.3 ") == (1, 2, 3, -1)

    def test_prereleases_and_garbage_rejected(self):
        for tag in (
            "v1.2.3-rc1",
            "v1.2.3-beta.1",
            "vi-v1.2.3",
            "vi-v1.2.3-rc1",
            "v1.2",
            "1.2.3",
            "release-1",
            "vv1.2.3",
            "",
        ):
            assert _parse_release_tag(tag) is None, tag

    def test_calver_tags_rejected(self):
        """Historical CalVer tags (v2026.7.20) must not win a numeric sort.

        The major component is capped at three digits, the same rule as
        _SEMVER_TAG_RE in scripts/write_install_stamp.py and
        latestReleaseFromLsRemote in apps/desktop. A four-digit year would
        rank above every SemVer release forever.
        """
        assert _parse_release_tag("v2026.7.20") is None
        assert _parse_release_tag("v1000.0.0") is None
        assert _parse_release_tag("v999.0.0") == (999, 0, 0, -1)

    def test_numeric_ordering_not_lexicographic(self):
        """v0.10.0 must sort above v0.9.0 — the whole point of tuple parsing."""
        newer, older = _parse_release_tag("v0.10.0"), _parse_release_tag("v0.9.0")
        assert newer is not None and older is not None
        assert newer > older


class TestLatestReleaseTagFromLsRemote:
    def test_picks_newest_final_release(self):
        output = (
            "aaa1\trefs/tags/v0.9.0\n"
            "bbb2\trefs/tags/v0.10.0\n"
            "ccc3\trefs/tags/v0.10.1-rc1\n"
            "ddd4\trefs/tags/some-other-tag\n"
        )
        tag, sha = _latest_release_tag_from_ls_remote(output)
        assert tag == "v0.10.0"
        assert sha == "bbb2"

    def test_picks_latest_vietnamese_iteration(self):
        output = (
            "base\trefs/tags/v0.20.0\n"
            "old\trefs/tags/vi-v0.20.0-14\n"
            "new\trefs/tags/vi-v0.20.0-15\n"
        )
        assert _latest_release_tag_from_ls_remote(output) == ("vi-v0.20.0-15", "new")

    def test_prefers_the_community_release_line_over_upstream_tags(self):
        output = "upstream\trefs/tags/v0.20.4\ncommunity\trefs/tags/vi-v0.20.0-28\n"
        assert _latest_release_tag_from_ls_remote(output) == (
            "vi-v0.20.0-28",
            "community",
        )

    def test_peeled_sha_wins_for_annotated_tags(self):
        output = "tagobj\trefs/tags/v1.0.0\ncommitsha\trefs/tags/v1.0.0^{}\n"
        tag, sha = _latest_release_tag_from_ls_remote(output)
        assert tag == "v1.0.0"
        assert sha == "commitsha"

    def test_no_release_tags(self):
        assert _latest_release_tag_from_ls_remote("aaa\trefs/tags/nightly\n") == (
            None,
            None,
        )
        assert _latest_release_tag_from_ls_remote("") == (None, None)

    def test_malformed_lines_ignored(self):
        output = "garbage line no tab\naaa\trefs/heads/main\nbbb\trefs/tags/v2.0.0\n"
        assert _latest_release_tag_from_ls_remote(output) == ("v2.0.0", "bbb")


class TestLatestPublicReleaseFromGitHub:
    def test_draft_candidate_is_invisible_until_published(self):
        releases = [
            {"tag_name": "vi-v0.20.0-28", "draft": True, "prerelease": True},
            {"tag_name": "vi-v0.20.0-25", "draft": False, "prerelease": False},
        ]
        assert _latest_public_release_tag_from_releases(releases) == "vi-v0.20.0-25"

    def test_published_community_prerelease_becomes_visible(self):
        releases = [
            {"tag_name": "vi-v0.20.0-28", "draft": False, "prerelease": True},
            {"tag_name": "vi-v0.20.0-25", "draft": False, "prerelease": False},
            {"tag_name": "v0.20.4", "draft": False, "prerelease": False},
        ]
        assert _latest_public_release_tag_from_releases(releases) == "vi-v0.20.0-28"

    def test_resolver_peels_only_the_published_release_tag(self, tmp_path):
        tag = "vi-v0.20.0-28"
        commit = "ab" * 20
        output = (
            f"{'cd' * 20}\trefs/tags/{tag}\n"
            f"{commit}\trefs/tags/{tag}^{{}}\n"
        )

        with (
            patch(
                "hermes_cli.update_cmd._github_latest_release_tag",
                return_value=tag,
            ),
            patch(
                "hermes_cli.update_cmd.subprocess.run",
                return_value=SimpleNamespace(returncode=0, stdout=output, stderr=""),
            ) as run,
        ):
            assert _resolve_latest_release_tag(["git"], tmp_path) == (tag, commit)

        assert run.call_args.args[0][-2:] == [
            f"refs/tags/{tag}",
            f"refs/tags/{tag}^{{}}",
        ]


class _Args:
    def __init__(self, branch=None):
        self.branch = branch


class TestStableChannelActive:
    def test_explicit_branch_always_wins(self):
        """--branch means main-style behavior regardless of channel config."""
        assert _stable_channel_active(_Args(branch="bb/gui")) is False

    def test_config_stable_activates(self, tmp_path):
        with (
            patch(
                "hermes_cli.config.load_config",
                return_value={"update": {"channel": "stable"}},
            ),
            patch(
                "hermes_cli.install_manifest.install_manifest_path",
                return_value=tmp_path / ".hermes-install.json",
            ),
        ):
            assert _stable_channel_active(_Args()) is True

    def test_default_config_stays_main(self, tmp_path):
        with (
            patch(
                "hermes_cli.config.load_config",
                return_value={"update": {"channel": "auto"}},
            ),
            patch(
                "hermes_cli.install_manifest.install_manifest_path",
                return_value=tmp_path / ".hermes-install.json",
            ),
        ):
            assert _stable_channel_active(_Args()) is False

    def test_config_failure_defaults_to_main(self, tmp_path):
        with (
            patch("hermes_cli.config.load_config", side_effect=RuntimeError("boom")),
            patch(
                "hermes_cli.install_manifest.install_manifest_path",
                return_value=tmp_path / ".hermes-install.json",
            ),
        ):
            assert _stable_channel_active(_Args()) is False
