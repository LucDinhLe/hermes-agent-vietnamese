import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const desktopRoot = join(scriptDir, '..')
export const sourceDir = join(desktopRoot, 'extensions', 'hermes-connector')
export const buildDir = join(desktopRoot, 'build', 'hermes-connector')
export const trustPath = join(desktopRoot, 'build', 'hermes-connector-trust.json')
export const expectedExtensionId = 'jabfgpkkfcoiiegikmdccooedjoooflm'

const allowedRootFiles = new Set(['README.md', 'manifest.json', 'popup.css', 'popup.html', 'popup.js'])

async function filesUnder(root) {
  const { readdir } = await import('node:fs/promises')
  const result = []

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) result.push(path)
    }
  }

  await walk(root)
  return result.sort((left, right) => relative(root, left).localeCompare(relative(root, right)))
}

export function extensionIdFromManifestKey(key) {
  const alphabet = 'abcdefghijklmnop'
  return [...createHash('sha256').update(Buffer.from(key, 'base64')).digest().subarray(0, 16)]
    .map(byte => `${alphabet[byte >> 4]}${alphabet[byte & 15]}`)
    .join('')
}

export async function inspectConnectorSource(root = sourceDir) {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  const rootFiles = (await filesUnder(root)).map(path => relative(root, path).replaceAll('\\', '/'))
  const unexpectedRoot = rootFiles.filter(path => !path.includes('/') && !allowedRootFiles.has(path))

  if (manifest.manifest_version !== 3 || manifest.incognito !== 'not_allowed') {
    throw new Error('Connector manifest must be MV3 with incognito disabled.')
  }
  if (extensionIdFromManifestKey(manifest.key) !== expectedExtensionId) {
    throw new Error('Connector manifest key changed the trusted extension ID.')
  }
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(['activeTab'])) {
    throw new Error('Connector default permissions changed.')
  }
  if (JSON.stringify(manifest.optional_permissions) !== JSON.stringify(['cookies'])) {
    throw new Error('Connector optional permissions changed.')
  }
  const allowedOrigins = ['http://*/*', 'https://*/*', 'http://127.0.0.1/*']
  if (JSON.stringify(manifest.optional_host_permissions) !== JSON.stringify(allowedOrigins)) {
    throw new Error('Connector optional host permissions changed.')
  }
  if (unexpectedRoot.length > 0) throw new Error(`Unexpected connector files: ${unexpectedRoot.join(', ')}`)

  const hash = createHash('sha256')
  for (const path of rootFiles) {
    hash.update(path, 'utf8')
    hash.update(Buffer.from([0]))
    hash.update(await readFile(join(root, path)))
    hash.update(Buffer.from([0]))
  }

  return {
    extensionId: expectedExtensionId,
    version: manifest.version,
    manifestVersion: manifest.manifest_version,
    permissions: manifest.permissions,
    optionalPermissions: manifest.optional_permissions,
    optionalHostPermissions: manifest.optional_host_permissions,
    files: rootFiles,
    sha256: hash.digest('hex')
  }
}

export async function buildConnectorExtension() {
  const trust = await inspectConnectorSource()
  await rm(buildDir, { recursive: true, force: true })
  await mkdir(dirname(buildDir), { recursive: true })
  await cp(sourceDir, buildDir, { recursive: true })
  await writeFile(trustPath, `${JSON.stringify(trust, null, 2)}\n`, 'utf8')
  return trust
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const trust = await buildConnectorExtension()
  process.stdout.write(`Hermes Connector ${trust.version} ${trust.sha256}\n`)
}
