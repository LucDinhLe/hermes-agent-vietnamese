import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const patch = readFileSync(path.join(root, 'patches', 'vietnamese-distribution-ui.patch'), 'utf8')
const about = readFileSync(
  path.join(root, 'edition', 'vietnamese', 'overlay', 'apps', 'desktop', 'src', 'app', 'settings', 'about-settings.tsx'),
  'utf8'
)

test('Browser is enforced as a tab in the Files rail while other previews retain upstream placement', () => {
  assert.match(patch, /kind === 'url' \? 'files' : 'workspace'/)
  assert.match(patch, /kind === 'url' \? 'center' : 'right'/)
  assert.match(patch, /enforce: tab => targetFor\(tab\.id\)\?\.kind === 'url'/)
})

test('production distribution update entry points fail closed before touching the upstream checkout', () => {
  assert.match(patch, /DISTRIBUTION_UPDATES_MANUAL = import\.meta\.env\.PROD/)
  assert.match(patch, /distribution-managed/)
  assert.match(patch, /không cập nhật trực tiếp checkout lõi Hermes/)
})

test('About owns Vietnamese product identity and does not expose the upstream update action', () => {
  assert.match(about, /Phát triển và Việt hóa bởi/)
  assert.match(about, /Kênh Hermes Vietnamese · cập nhật bằng bộ cài/)
  assert.doesNotMatch(about, /startActiveUpdate|checkUpdates|Nhánh main/)
})
