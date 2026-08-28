import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyBranding } from './lib/branding.mjs'
import { readJson } from './lib/contracts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engineFlag = process.argv.indexOf('--engine-dir')
const engineDir = engineFlag >= 0 ? process.argv[engineFlag + 1] : null

if (!engineDir) {
  throw new Error('Usage: node scripts/apply-branding.mjs --engine-dir <materialized engine>')
}

const paths = applyBranding(path.resolve(engineDir), readJson(path.join(ROOT, 'edition.json')))

console.log(`[branding] updated ${paths.join(', ')} without changing installer identity`)
