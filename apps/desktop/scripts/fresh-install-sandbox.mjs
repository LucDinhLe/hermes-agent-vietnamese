import path from 'node:path'

export function freshInstallSandboxPrefix({ platform, localAppData, homeDir, tempDir }) {
  if (platform === 'win32') {
    const stableLocalRoot = localAppData || path.join(homeDir, 'AppData', 'Local')
    return path.join(
      stableLocalRoot,
      'Hermes',
      'smoke-tests',
      'hermes-desktop-fresh-install-'
    )
  }

  return path.join(tempDir, 'hermes-desktop-fresh-install-')
}
