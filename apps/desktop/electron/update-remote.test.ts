/**
 * Tests for electron/update-remote.ts — the remote-detection helpers that
 * keep passive update checks off the SSH origin for official installs.
 *
 * Run with: node --test electron/update-remote.test.ts
 * (Wired into npm test:desktop:platforms in package.json.)
 *
 * Why this matters: a public install can carry
 * origin=git@github.com:LucDinhLe/hermes-agent-vietnamese.git. A background
 * `git fetch origin` then authenticates over SSH and, with a FIDO2/passkey
 * key, triggers an unexplained hardware-touch prompt. isOfficialSshRemote
 * must reliably recognize the official SSH remote (in every URL form,
 * case-insensitively) so the caller can swap in the anonymous HTTPS path —
 * while NOT misclassifying forks or other hosts. Both SSH and HTTPS forms of
 * the official repo use the read-only passive-check path so first-run
 * bootstrap never races a second mutating fetch.
 */

import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  canonicalGitHubRemote,
  isOfficialRemote,
  isOfficialSshRemote,
  isSshRemote,
  OFFICIAL_REPO_CANONICAL,
  OFFICIAL_REPO_HTTPS_URL
} from './update-remote'

test('canonicalGitHubRemote normalizes SSH and HTTPS forms to the same value', () => {
  assert.equal(canonicalGitHubRemote('git@github.com:LucDinhLe/hermes-agent-vietnamese.git'), OFFICIAL_REPO_CANONICAL)
  assert.equal(canonicalGitHubRemote('git@github.com:LucDinhLe/hermes-agent-vietnamese'), OFFICIAL_REPO_CANONICAL)
  assert.equal(
    canonicalGitHubRemote('ssh://git@github.com/LucDinhLe/hermes-agent-vietnamese.git'),
    OFFICIAL_REPO_CANONICAL
  )
  assert.equal(
    canonicalGitHubRemote('https://github.com/LucDinhLe/hermes-agent-vietnamese.git'),
    OFFICIAL_REPO_CANONICAL
  )
  // Case-insensitive: an uppercased owner still canonicalizes to the same repo.
  assert.equal(canonicalGitHubRemote('git@github.com:lucdinhle/hermes-agent-vietnamese.git'), OFFICIAL_REPO_CANONICAL)
  // Trailing slashes are stripped.
  assert.equal(canonicalGitHubRemote('https://github.com/LucDinhLe/hermes-agent-vietnamese/'), OFFICIAL_REPO_CANONICAL)
})

test('canonicalGitHubRemote is empty for falsy input', () => {
  assert.equal(canonicalGitHubRemote(''), '')
  assert.equal(canonicalGitHubRemote(null), '')
  assert.equal(canonicalGitHubRemote(undefined), '')
})

test('isSshRemote detects scp-like and ssh:// forms only', () => {
  assert.equal(isSshRemote('git@github.com:LucDinhLe/hermes-agent-vietnamese.git'), true)
  assert.equal(isSshRemote('ssh://git@github.com/LucDinhLe/hermes-agent-vietnamese.git'), true)
  assert.equal(isSshRemote('https://github.com/LucDinhLe/hermes-agent-vietnamese.git'), false)
  assert.equal(isSshRemote(''), false)
  assert.equal(isSshRemote(null), false)
})

test('isOfficialSshRemote is true only for the official repo over SSH', () => {
  assert.equal(isOfficialSshRemote('git@github.com:LucDinhLe/hermes-agent-vietnamese.git'), true)
  assert.equal(isOfficialSshRemote('git@github.com:LucDinhLe/hermes-agent-vietnamese'), true)
  assert.equal(isOfficialSshRemote('ssh://git@github.com/LucDinhLe/hermes-agent-vietnamese.git'), true)
  // Case-insensitive owner/repo match.
  assert.equal(isOfficialSshRemote('git@github.com:lucdinhle/hermes-agent-vietnamese.git'), true)
})

test('isOfficialSshRemote does NOT match forks, other hosts, or HTTPS', () => {
  // A fork over SSH belongs to the user — fetching it is their own remote,
  // not the official upstream, so the SSH-avoidance swap must not apply.
  assert.equal(isOfficialSshRemote('git@github.com:someuser/hermes-agent.git'), false)
  // Same repo name on a different host is not the official repo.
  assert.equal(isOfficialSshRemote('git@gitlab.com:NousResearch/hermes-agent.git'), false)
  // HTTPS is official but is not an SSH remote.
  assert.equal(isOfficialSshRemote('https://github.com/LucDinhLe/hermes-agent-vietnamese.git'), false)
  assert.equal(isOfficialSshRemote(''), false)
  assert.equal(isOfficialSshRemote(null), false)
})

test('isOfficialRemote matches both public transports but preserves forks', () => {
  assert.equal(isOfficialRemote('git@github.com:LucDinhLe/hermes-agent-vietnamese.git'), true)
  assert.equal(isOfficialRemote('https://github.com/LucDinhLe/hermes-agent-vietnamese.git'), true)
  assert.equal(isOfficialRemote('https://github.com/another-owner/hermes-agent-vietnamese.git'), false)
  assert.equal(isOfficialRemote(''), false)
  assert.equal(isOfficialRemote(null), false)
})

test('OFFICIAL_REPO_HTTPS_URL canonicalizes to OFFICIAL_REPO_CANONICAL', () => {
  // Invariant: the URL we substitute in must be the same repo we detect.
  assert.equal(canonicalGitHubRemote(OFFICIAL_REPO_HTTPS_URL), OFFICIAL_REPO_CANONICAL)
})
