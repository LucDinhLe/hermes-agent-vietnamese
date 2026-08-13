from pathlib import Path


INSTALLER = Path(__file__).resolve().parents[1] / "scripts" / "install.ps1"


def test_repository_clone_enables_windows_long_paths_before_any_clone() -> None:
    source = INSTALLER.read_text(encoding="utf-8")
    config_index = source.index('$env:GIT_CONFIG_KEY_1 = "core.longpaths"')
    ssh_clone_index = source.index(
        "git -c windows.appendAtomically=false clone --depth 1 --branch $Branch $RepoUrlSsh $InstallDir"
    )
    https_clone_index = source.index(
        "git -c windows.appendAtomically=false clone --depth 1 --branch $Branch $RepoUrlHttps $InstallDir"
    )

    assert '$env:GIT_CONFIG_COUNT = "2"' in source
    assert '$env:GIT_CONFIG_VALUE_1 = "true"' in source
    assert "git config --global core.longpaths true" not in source
    assert config_index < ssh_clone_index < https_clone_index
