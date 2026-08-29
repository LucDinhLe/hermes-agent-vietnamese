import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

function fail(message) {
  throw new Error(`[resident-verify] ${message}`)
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map(arg => /^--([^=]+)=(.*)$/.exec(arg))
    .filter(Boolean)
    .map(match => [match[1], match[2]])
)

for (const required of ['resources', 'candidate', 'engine-commit', 'receipt-sha256']) {
  if (!args[required]) fail(`missing --${required}=...`)
}

const resources = path.resolve(args.resources)
const payload = path.join(resources, 'agent-payload')
const manifestPath = path.join(payload, 'manifest.json')
const receiptPath = path.join(resources, 'edition-receipt.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))

if (manifest.schemaVersion !== 2) fail('payload schema is not 2')
if (manifest.candidate !== args.candidate) fail(`candidate mismatch: ${manifest.candidate}`)
if (manifest.engineCommit !== args['engine-commit']) fail(`engine mismatch: ${manifest.engineCommit}`)
if (manifest.editionReceiptSha256 !== args['receipt-sha256']) fail('manifest receipt digest mismatch')
if (sha256(receiptPath) !== args['receipt-sha256']) fail('packaged receipt bytes mismatch')
if (receipt.engine?.commit !== args['engine-commit']) fail('edition receipt engine mismatch')

for (const item of ['repo', 'uv', 'python', 'site-packages', 'node']) {
  if (manifest.items?.[item]?.status !== 'staged') fail(`payload item is not staged: ${item}`)
  if (!fs.existsSync(path.join(payload, item))) fail(`payload item is absent: ${item}`)
}

for (const entry of receipt.materializedFiles || []) {
  const runtimeFile = path.join(payload, 'repo', ...entry.path.split('/'))
  if (!fs.statSync(runtimeFile, { throwIfNoEntry: false })?.isFile()) fail(`runtime file missing: ${entry.path}`)

  const actual = sha256(runtimeFile)
  if (actual !== entry.sha256) fail(`runtime file digest mismatch: ${entry.path}`)
}

const pythonRoot = path.join(payload, 'python')
const pythonFound = fs
  .readdirSync(pythonRoot)
  .some(name => fs.existsSync(path.join(pythonRoot, name, 'python.exe')))
if (!pythonFound) fail('resident Python executable is absent')
if (!fs.existsSync(path.join(payload, 'node', 'node.exe'))) fail('resident Node executable is absent')
if (!fs.existsSync(path.join(payload, 'uv', 'uv.exe'))) fail('resident uv executable is absent')

console.log(
  `[resident-verify] OK ${manifest.candidate}: engine ${manifest.engineCommit.slice(0, 12)}, ` +
    `${receipt.materializedFiles.length} receipt-bound runtime files`
)
