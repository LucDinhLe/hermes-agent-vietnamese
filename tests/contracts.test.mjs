import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  assertSafeRelativePath,
  collectFiles,
  isForbiddenPath,
  matchesAllowedPath,
  normalizeRepositoryUrl,
  pathsDeclaredByPatch,
  sha256Tree
} from '../scripts/lib/contracts.mjs'
import { verifyEdition } from '../scripts/verify-edition.mjs'

test('repository contract verifies and pins the expected engine', () => {
  const receipt = verifyEdition()

  assert.match(receipt.lock.source.tag, /^v\d{4}\.\d{1,2}\.\d{1,2}$/)
  assert.match(receipt.lock.source.tagObjectSha, /^[0-9a-f]{40}$/)
  assert.match(receipt.lock.source.commit, /^[0-9a-f]{40}$/)
  assert.equal(receipt.lock.policy.followMovingBranch, false)
  assert.equal(receipt.lock.policy.requireAnnotatedTag, true)
  assert.equal(receipt.lock.policy.requireExactCommit, true)
  assert.equal(receipt.edition.identity.activation, 'blocked-until-migration-gate')
  assert.equal(
    receipt.edition.allowedPaths.every((entry) => entry.replace(/\/\*\*$/, '').startsWith('apps/desktop/')),
    true
  )
  assert.equal(receipt.overlayInventory.length, receipt.overlayFiles.length)
  assert.equal(
    receipt.overlayInventory.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256)),
    true
  )
})

test('allowlist supports exact paths and directory overlays only', () => {
  const allowed = ['apps/desktop/src/i18n/vi.ts', 'apps/desktop/src/plugins/hermes-vietnamese/**']

  assert.equal(matchesAllowedPath('apps/desktop/src/i18n/vi.ts', allowed), true)
  assert.equal(matchesAllowedPath('apps/desktop/src/plugins/hermes-vietnamese/plugin.tsx', allowed), true)
  assert.equal(matchesAllowedPath('apps/desktop/src/plugins/other/plugin.tsx', allowed), false)
})

test('unsafe and engine-owned paths fail closed', () => {
  assert.throws(() => assertSafeRelativePath('../agent/run.py'), /stay inside/)
  for (const unsafe of [
    'C:relative/file.txt',
    'file.txt:stream',
    'apps/./desktop/file.txt',
    'apps/desktop/CON.txt',
    'apps/desktop/trailing. ',
    'apps/desktop/*.ts'
  ]) {
    assert.throws(() => assertSafeRelativePath(unsafe), /stay inside/)
  }
  assert.throws(
    () =>
      assertSafeRelativePath('apps/desktop/foo*/**', 'allowed path', {
        allowDirectoryGlob: true
      }),
    /stay inside/
  )
  assert.equal(isForbiddenPath('agent/run.py', ['agent/', 'gateway/']), true)
  assert.equal(isForbiddenPath('apps/desktop/src/a.ts', ['agent/', 'gateway/']), false)
})

test('release remote matching normalizes common GitHub transports only to one identity', () => {
  assert.equal(
    normalizeRepositoryUrl('git@github.com:LucDinhLe/hermes-agent-vietnamese.git'),
    'https://github.com/lucdinhle/hermes-agent-vietnamese'
  )
  assert.equal(
    normalizeRepositoryUrl('https://github.com/LucDinhLe/hermes-agent-vietnamese/'),
    'https://github.com/lucdinhle/hermes-agent-vietnamese'
  )
  assert.equal(normalizeRepositoryUrl(''), null)
})

test('tree digest is deterministic and path-sensitive', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hermes-edition-contract-'))
  mkdirSync(path.join(root, 'a'))
  writeFileSync(path.join(root, 'a', 'one.txt'), 'one')
  writeFileSync(path.join(root, 'two.txt'), 'two')

  assert.deepEqual(collectFiles(root), ['a/one.txt', 'two.txt'])
  assert.equal(sha256Tree(root), sha256Tree(root))
})

test('patch path parser rejects undeclared renames', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hermes-edition-patch-'))
  const file = path.join(root, 'rename.patch')
  writeFileSync(file, 'diff --git a/a.txt b/b.txt\n')

  assert.throws(() => pathsDeclaredByPatch(file), /Rename patches are not allowed/)
})
