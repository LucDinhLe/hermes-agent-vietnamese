import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const read = path => readFileSync(join(import.meta.dirname, path), 'utf8')

test('Experimental product identity has one name and one technical version', () => {
  const metadata = JSON.parse(read('../product-metadata.json'))
  const pkg = JSON.parse(read('../../../../package.json'))
  const composition = JSON.parse(read('../../../../build/experimental-composition.json'))
  const main = read('../../../../electron/main.ts')

  assert.equal(metadata.displayName, 'Hermes Vietnamese Advisor Experimental')
  assert.equal(metadata.productVersion, 'V33 Experimental')
  assert.equal(metadata.technicalVersion, '0.33.0-dev.11-advisor-exp.10')
  assert.equal(pkg.productName, metadata.displayName)
  assert.equal(pkg.version, metadata.technicalVersion)
  assert.equal(composition.productVersion, metadata.technicalVersion)
  assert.match(composition.runtimeIsolation.candidateId, /^d11e9-f5379d57-/)
  assert.equal(composition.agentSurface.sessionStripPurpose, 'select_persistent_agent')
  assert.equal(composition.agentSurface.temporarySubagentRouteExposed, false)
  assert.match(main, /HERMES_DESKTOP_APP_NAME \|\| 'Hermes Vietnamese Advisor Experimental'/)
})

test('Experimental runtime id stays inside the Windows path budget', () => {
  const staging = read('../../../../scripts/stage-advisor-runtime.mjs')
  const sync = read('../../../../scripts/Sync-Hermes-Advisor-Runtime.ps1')

  assert.match(staging, /candidateId\.length > 32/)
  assert.match(staging, /sourceCommit\.slice\(0, 8\)/)
  assert.match(staging, /buildCommit\.slice\(0, 8\)/)
  assert.doesNotMatch(staging, /candidateId = `\$\{pkg\.version\}/)
  assert.match(sync, /'\.s-' \+ \[guid\]::NewGuid\(\)\.ToString\('N'\)\.Substring\(0, 8\)/)
  assert.doesNotMatch(sync, /'\.staging-' \+ \[guid\]::NewGuid/)
})

test('persistent-agent route and creation controls stay Vietnamese', () => {
  const source = read('../../hermes-bots/plugin.js')

  for (const copy of ['Tác nhân', 'Tìm tác nhân…', 'Tạo tác nhân', 'Tạo nhóm trò chuyện']) {
    assert.match(source, new RegExp(copy))
  }

  for (const leak of ["children: 'Bots'", "placeholder: 'Search bots…'", "'New Agent'", "'New Group Chat'"]) {
    assert.doesNotMatch(source, new RegExp(leak))
  }
})

test('MoA settings explain their real role in Vietnamese', () => {
  const locale = read('../../../i18n/vi.ts')
  const settings = read('../../../app/settings/model-settings.tsx')

  assert.match(locale, /title: 'Hội đồng cố vấn \(MoA\)'/)
  assert.match(locale, /Model tham chiếu đóng góp ý kiến; model tổng hợp tạo câu trả lời cuối cùng/)
  assert.match(settings, /title=\{moaText\.title\}/)
  assert.doesNotMatch(settings, />Mixture of Agents</)
  assert.doesNotMatch(settings, /Configure named presets/)
})

test('student-facing utility labels stay Vietnamese', () => {
  const locale = read('../../../i18n/vi.ts')
  const terminal = read('../../../app/right-sidebar/terminal/terminals.ts')

  assert.match(locale, /newCron: 'Tác vụ mới'/)
  assert.match(locale, /pill: 'Tìm kiếm'/)
  assert.match(terminal, /title: 'Dòng lệnh'/)
})
