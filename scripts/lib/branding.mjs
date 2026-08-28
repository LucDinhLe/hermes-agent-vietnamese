import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const BRANDING_PATHS = ['apps/desktop/index.html', 'apps/desktop/package.json']

function identityOf(manifest) {
  return {
    appId: manifest.build?.appId,
    artifactName: manifest.build?.artifactName,
    buildProductName: manifest.build?.productName,
    executableName: manifest.build?.executableName,
    packageName: manifest.name,
    packageProductName: manifest.productName,
    protocol: manifest.build?.protocols?.[0]?.schemes?.[0],
    protocolSchemes: manifest.build?.protocols?.map((entry) => entry.schemes)
  }
}

export function assertProtectedIdentity(manifest, expected) {
  const actual = identityOf(manifest)

  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
      throw new Error(`Branding must not change ${key}: expected ${value}, got ${actual[key]}`)
    }
  }
}

export function brandPackageManifest(input, edition) {
  const manifest = structuredClone(input)
  const displayName = edition.displayName

  assertProtectedIdentity(manifest, edition.branding.protectedIdentity)

  manifest.description = edition.branding.description
  manifest.build.protocols[0].name = `${displayName} Protocol`
  manifest.build.dmg.title = `Install ${displayName}`
  manifest.build.mac.extendInfo.CFBundleDisplayName = displayName
  manifest.build.win.legalTrademarks = displayName
  manifest.build.linux.synopsis = `${displayName}, the MIT community desktop edition of Hermes Agent.`
  manifest.build.linux.desktop = {
    ...(manifest.build.linux.desktop ?? {}),
    entry: {
      ...(manifest.build.linux.desktop?.entry ?? {}),
      Name: displayName
    }
  }
  manifest.build.nsis.shortcutName = displayName
  manifest.build.nsis.uninstallDisplayName = displayName

  assertProtectedIdentity(manifest, edition.branding.protectedIdentity)

  return manifest
}

export function brandIndexHtml(input, title) {
  const marker = '<title>Hermes</title>'
  const occurrences = input.split(marker).length - 1

  if (occurrences !== 1) {
    throw new Error(`Expected exactly one upstream title marker, found ${occurrences}`)
  }

  return input.replace(marker, `<title>${title}</title>`)
}

export function applyBranding(engineRoot, edition) {
  const packagePath = path.join(engineRoot, 'apps', 'desktop', 'package.json')
  const indexPath = path.join(engineRoot, 'apps', 'desktop', 'index.html')
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
  const brandedManifest = brandPackageManifest(manifest, edition)
  const index = readFileSync(indexPath, 'utf8')

  writeFileSync(packagePath, `${JSON.stringify(brandedManifest, null, 2)}\n`, 'utf8')
  writeFileSync(indexPath, brandIndexHtml(index, edition.branding.windowTitle), 'utf8')

  return [...BRANDING_PATHS]
}
