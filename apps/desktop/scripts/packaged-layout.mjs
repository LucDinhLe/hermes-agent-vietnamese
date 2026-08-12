const SUPPORTED_ARCHES = new Set(['arm64', 'x64'])
const SUPPORTED_PLATFORMS = new Set(['darwin', 'linux', 'win32'])

export function packagedAppDirectoryName(platform, arch) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`Unsupported packaged-app platform: ${platform}`)
  }
  if (!SUPPORTED_ARCHES.has(arch)) {
    throw new Error(`Unsupported packaged-app architecture: ${arch}`)
  }

  if (platform === 'darwin') {
    return `mac-${arch}`
  }

  const platformName = platform === 'win32' ? 'win' : 'linux'
  return `${platformName}${arch === 'x64' ? '' : `-${arch}`}-unpacked`
}
