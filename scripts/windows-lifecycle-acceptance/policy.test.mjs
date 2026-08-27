import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { restartMockServer, startMockServer } from '../../apps/desktop/e2e/mock-server.ts'

import {
  REQUIRED_LIFECYCLE_GATES,
  ROLLBACK_COMMIT,
  ROLLBACK_SHA256,
  ROLLBACK_SIZE,
  V32_SOURCE_COMMIT,
  V32_SOURCE_SHA256,
  V32_SOURCE_SIZE,
  WINDOWS_LIFECYCLE_NODE_SHA256,
  WINDOWS_LIFECYCLE_NODE_VERSION,
  assertSupportedGithubHostedWindowsRunner,
  assertSupportedWindowsSandboxHost,
  buildWindowsSandboxConfig,
  validateLifecycleDescriptor,
  validateLifecycleReceipt
} from './policy.mjs'

const guestScript = fs.readFileSync(new URL('./guest.ps1', import.meta.url), 'utf8')
const lifecycleSpec = fs.readFileSync(
  new URL('../../apps/desktop/e2e/v32-lifecycle-acceptance.spec.ts', import.meta.url),
  'utf8'
)
const fixtureScript = fs.readFileSync(new URL('../../apps/desktop/e2e/fixtures.ts', import.meta.url), 'utf8')

const candidate = {
  commit: 'a'.repeat(40),
  fileName: 'Hermes-0.32.1-vi.17-win-x64.exe',
  sha256: '1'.repeat(64),
  size: 320_000_000,
  tag: 'vi-v0.32.1-17'
}
const previous = {
  commit: V32_SOURCE_COMMIT,
  fileName: 'Hermes-Vietnamese-Windows-x64-Setup.exe',
  identitySource: 'immutable-public-v32',
  sha256: V32_SOURCE_SHA256,
  size: V32_SOURCE_SIZE,
  tag: 'vi-v0.32.0-1'
}
const rollback = {
  commit: ROLLBACK_COMMIT,
  fileName: 'Hermes-v39.exe',
  identitySource: 'verified-v31-release-audit',
  sha256: ROLLBACK_SHA256,
  size: ROLLBACK_SIZE,
  tag: 'vi-v0.20.4-39'
}
const descriptor = {
  candidate,
  harnessCommit: 'b'.repeat(40),
  previous,
  releaseClass: 'community-prerelease',
  rollback,
  runId: '12345678-1234-1234-1234-123456789abc',
  schemaVersion: 1
}

test('descriptor binds the three exact lifecycle installers and rejects byte reuse', () => {
  const validated = validateLifecycleDescriptor(descriptor)
  assert.equal(validated.candidate.commit, candidate.commit)
  assert.equal(validated.harnessCommit, descriptor.harnessCommit)
  assert.equal(validated.previous.tag, 'vi-v0.32.0-1')
  assert.equal(validated.rollback.tag, 'vi-v0.20.4-39')

  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, candidate: { ...candidate, sha256: previous.sha256 } }),
    /three distinct byte streams/
  )
  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, previous: { ...previous, sha256: '2'.repeat(64) } }),
    /pinned vi-v0\.32\.0-1/
  )
  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, rollback: { ...rollback, tag: 'vi-v0.20.4-40' } }),
    /must be vi-v0\.20\.4-39/
  )
  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, candidate: { ...candidate, commit: 'not-a-commit' } }),
    /candidate\.commit must be a full lowercase 40-character commit SHA/
  )
  assert.equal(
    validateLifecycleDescriptor({
      ...descriptor,
      candidate: { ...candidate, fileName: 'Hermes-0.32.1-vi.18-win-x64.exe', tag: 'vi-v0.32.1-18' }
    }).candidate.tag,
    'vi-v0.32.1-18'
  )
  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, candidate: { ...candidate, tag: 'vi-v0.32.1-16' } }),
    /v32\.1 successor/
  )
  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, candidate: { ...candidate, tag: 'vi-v0.32.2-1' } }),
    /v32\.1 successor/
  )
})

test('host gate never degrades an unsupported machine into a skipped acceptance', () => {
  assert.equal(WINDOWS_LIFECYCLE_NODE_VERSION, 'v26.5.1')
  assert.equal(WINDOWS_LIFECYCLE_NODE_SHA256, 'b48b0224081224cda1f49374e2fc63d143041ade51754f0cc6608fe8510ba29e')
  assert.equal(
    assertSupportedWindowsSandboxHost({
      arch: 'x64',
      nodeVersion: 'v26.5.1',
      platform: 'win32',
      sandboxExecutableExists: true
    }),
    true
  )
  assert.throws(
    () =>
      assertSupportedWindowsSandboxHost({
        arch: 'x64',
        nodeVersion: 'v26.5.1',
        platform: 'win32',
        sandboxExecutableExists: false
      }),
    /cannot run safely/
  )
  assert.throws(
    () =>
      assertSupportedWindowsSandboxHost({
        arch: 'arm64',
        nodeVersion: 'v26.5.1',
        platform: 'win32',
        sandboxExecutableExists: true
      }),
    /requires win32\/x64/
  )
})

test('GitHub-hosted gate requires the exact ephemeral Windows VM contract', () => {
  const supported = {
    arch: 'x64',
    githubActions: 'true',
    hypervisorPresent: true,
    model: 'Virtual Machine',
    nodeVersion: 'v26.5.1',
    platform: 'win32',
    runnerEnvironment: 'github-hosted',
    runnerOs: 'Windows'
  }
  assert.equal(assertSupportedGithubHostedWindowsRunner(supported), true)
  assert.throws(
    () => assertSupportedGithubHostedWindowsRunner({ ...supported, runnerEnvironment: 'self-hosted' }),
    /GitHub-hosted Windows environment contract/
  )
  assert.throws(
    () =>
      assertSupportedGithubHostedWindowsRunner({
        ...supported,
        hypervisorPresent: false,
        model: 'Physical workstation'
      }),
    /virtual-machine boundary/
  )
})

test('guest preflight failures always leave a receipt-capable diagnostic', () => {
  assert.match(guestScript, /Join-Path \$EvidenceRoot 'lifecycle-failure\.txt'/)
  assert.match(guestScript, /Write-Receipt 'failed' \$failure/)
  assert.match(guestScript, /Write-Error "Windows lifecycle guest failed closed: \$failure"/)
})

test('guest parameters never shadow the read-only PowerShell HOME variable', () => {
  assert.doesNotMatch(guestScript, /\$Home\b/i)
  assert.match(guestScript, /\[string\]\$HermesHome/)
})

test('every guest Playwright phase is declared and handled by the lifecycle spec', () => {
  const declaredBlock = lifecycleSpec.match(/const ACTIONS = \[([\s\S]*?)\]\s+as const/)?.[1] ?? ''
  const declared = new Set([...declaredBlock.matchAll(/'([^']+)'/g)].map(match => match[1]))
  const handled = new Set([...lifecycleSpec.matchAll(/case '([^']+)':/g)].map(match => match[1]))
  const literalGuestActions = [...guestScript.matchAll(/Invoke-PlaywrightPhase\s+`?\s*'([^']+)'/g)].map(
    match => match[1]
  )
  const uninstallModes = [...guestScript.matchAll(/Invoke-GuiUninstall\s+'([^']+)'/g)].map(
    match => `uninstall-${match[1]}`
  )
  const guestActions = [...new Set([...literalGuestActions, ...uninstallModes])].sort()

  assert.deepEqual(guestActions, [
    'onboarding',
    'project-session-safety',
    'safe-tool',
    'seed-v32',
    'seed-v321-rollback',
    'uninstall-full',
    'uninstall-lite',
    'verify-lite-reinstall',
    'verify-repair',
    'verify-rollback',
    'verify-update'
  ])
  for (const action of guestActions) {
    assert.ok(declared.has(action), `guest action ${action} must be declared in ACTIONS`)
    assert.ok(handled.has(action), `guest action ${action} must have an explicit switch case`)
  }
})

test('native stderr warnings are logged while the native exit code remains authoritative', () => {
  const nativeLogger = guestScript.match(/function Invoke-NativeLogged \{[\s\S]*?\r?\n\}/)?.[0] ?? ''
  assert.match(nativeLogger, /\$ErrorActionPreference = 'Continue'/)
  assert.match(nativeLogger, /\$nativeOutput = @\(& \$Executable @Arguments 2>&1\)/)
  assert.match(nativeLogger, /\$global:LASTEXITCODE = 0/)
  assert.match(nativeLogger, /\$exitCode = \$global:LASTEXITCODE/)
  assert.match(nativeLogger, /Assert-True \(\$exitCode -eq 0\)/)
  assert.doesNotMatch(nativeLogger, /2>&1 \| Tee-Object/)
})

test('NSIS install completion waits for both exact registry keys instead of racing the installer', () => {
  assert.match(guestScript, /function Wait-InstallState/)
  assert.match(guestScript, /Test-Path -LiteralPath \$ProductKey[\s\S]*?Test-Path -LiteralPath \$UninstallKey/)
  assert.match(guestScript, /function Invoke-NsisInstall/)
  assert.match(
    guestScript,
    /Start-Process[\s\S]*?-ArgumentList @\('\/S', '\/currentuser'\)[\s\S]*?-PassThru[\s\S]*?-Wait/
  )
  assert.match(guestScript, /\$log = Invoke-NsisInstall \$Installer \$LogName/)
  assert.match(guestScript, /\$state = Wait-InstallState \$LogName/)
  assert.doesNotMatch(guestScript, /\$state = Get-InstallState\r?\n/)
  assert.match(guestScript, /install-diagnostics-\$Stage\.json/)
  assert.match(guestScript, /hklm32Uninstall/)
})

test('repair fixture snapshots component size before moving the live FileInfo path', () => {
  const repairFixture = guestScript.match(/function Damage-RepairFixture \{[\s\S]*?\r?\n\}/)?.[0] ?? ''
  const sizeCapture = '$originalSize = [Int64]$original.Length'
  const captureIndex = repairFixture.indexOf(sizeCapture)
  const moveIndex = repairFixture.indexOf('  Move-Item -LiteralPath $component')
  assert.ok(captureIndex >= 0, 'repair fixture must capture an immutable original size')
  assert.ok(moveIndex > captureIndex, 'repair fixture must capture size before moving the component')
  assert.equal((repairFixture.match(/\$original\.Length/g) ?? []).length, 1)
  assert.match(repairFixture, /originalSize = \$originalSize/)
  assert.match(repairFixture, /OriginalSize = \$originalSize/)
})

test('lifecycle E2E accepts only the isolation mode already validated by the guest', () => {
  assert.match(guestScript, /\$env:HERMES_LIFECYCLE_EVIDENCE_ROOT = \$EvidenceRoot/)
  assert.match(guestScript, /\$env:HERMES_LIFECYCLE_ISOLATION_MODE = \$IsolationMechanism/)
  assert.match(guestScript, /'HERMES_LIFECYCLE_EVIDENCE_ROOT'/)
  assert.match(guestScript, /'HERMES_LIFECYCLE_ISOLATION_MODE'/)
  assert.match(lifecycleSpec, /requireAbsolutePath\('HERMES_LIFECYCLE_EVIDENCE_ROOT'\)/)
  assert.match(lifecycleSpec, /requiredEnv\('HERMES_LIFECYCLE_ISOLATION_MODE'\)/)
  assert.match(lifecycleSpec, /isolationMode === 'windows-sandbox'[\s\S]*?username !== 'wdagutilityaccount'/)
  assert.match(lifecycleSpec, /isolationMode === 'github-hosted-ephemeral-vm'/)
  assert.match(lifecycleSpec, /process\.env\.GITHUB_ACTIONS !== 'true'/)
  assert.match(lifecycleSpec, /process\.env\.RUNNER_ENVIRONMENT !== 'github-hosted'/)
  assert.match(lifecycleSpec, /process\.env\.RUNNER_OS !== 'Windows'/)
  assert.match(lifecycleSpec, /isStrictlyWithin\(HOSTED_EVIDENCE_ROOT, evidenceRoot\)/)
  assert.match(lifecycleSpec, /isStrictlyWithin\(evidenceRoot, screenshotPath\)/)
  assert.match(lifecycleSpec, /unsupported HERMES_LIFECYCLE_ISOLATION_MODE/)
})

test('self-uninstall disables only the dead-transport recorder and keeps explicit evidence', () => {
  const uninstallCases = lifecycleSpec.match(/case 'uninstall-lite':[\s\S]*?\r?\n\s*break/)?.[0] ?? ''
  const captureHelper = lifecycleSpec.match(/async function captureEvidence[\s\S]*?\r?\n\}/)?.[0] ?? ''
  assert.match(lifecycleSpec, /const selfUninstallAction =/)
  assert.match(lifecycleSpec, /test\.use\(selfUninstallAction \? \{ screenshot: 'off', trace: 'off' \} : \{\}\)/)
  assert.match(uninstallCases, /await captureEvidence\(running\.page, context\)/)
  assert.match(uninstallCases, /await confirmGuiUninstall\(running\)/)
  assert.ok(
    uninstallCases.indexOf('await captureEvidence(running.page, context)') <
      uninstallCases.indexOf('await confirmGuiUninstall(running)')
  )
  assert.match(captureHelper, /await page\.screenshot\(\{ fullPage: true, path: context\.screenshotPath \}\)/)
})

test('localized onboarding readiness uses the overlay contract and never retries a dirty lifecycle profile', () => {
  const onboardingWait = fixtureScript.match(/export async function waitForOnboarding[\s\S]*?\r?\n\}/)?.[0] ?? ''
  assert.match(onboardingWait, /locator\('\[class\*=\"z-\(--z-onboarding\)\"\]'\)/)
  assert.match(onboardingWait, /overlay\.locator\('button'\)\.first\(\)\.waitFor/)
  assert.doesNotMatch(onboardingWait, /text\.includes/)
  assert.match(lifecycleSpec, /test\.describe\.configure\(\{ mode: 'serial', retries: 0, timeout: 360_000 \}\)/)
})

test('lifecycle messages use the contenteditable keyboard path instead of clicking beneath its composer surface', () => {
  const sendHelper = lifecycleSpec.match(/async function sendAndWaitForReply[\s\S]*?\r?\n\}/)?.[0] ?? ''
  assert.match(sendHelper, /await input\.fill\(prompt\)/)
  assert.match(sendHelper, /await expect\(input\)\.toHaveText\(prompt\)/)
  assert.match(sendHelper, /await input\.press\('Enter'\)/)
  assert.doesNotMatch(sendHelper, /input\.click\(\)/)
})

test('exact lifecycle proves project metadata actions never hide or delete session data', () => {
  const projectPhase = lifecycleSpec.match(/async function runProjectSessionSafetyPhase[\s\S]*?\r?\n\}/)?.[0] ?? ''
  const openProjectsHelper = lifecycleSpec.match(/async function openProjectsManager[\s\S]*?\r?\n\}/)?.[0] ?? ''
  const projectEntry =
    projectPhase.match(/const hideCard[\s\S]*?await running\.page\.keyboard\.press\('Control\+N'\)/)?.[0] ?? ''
  const projectDisclosure =
    projectPhase.match(
      /Hide \$\{PROJECT_HIDE_NAME\} sessions\|Ẩn \$\{PROJECT_HIDE_NAME\} phiên[\s\S]*?await running\.page\.getByRole\('button', \{ name: \/\^\(All projects/
    )?.[0] ?? ''
  const projectMetadataActions =
    projectPhase.match(
      /await projectCard\(running\.page, PROJECT_HIDE_NAME\)[\s\S]*?(?=await running\.app\.close\(\))/
    )?.[0] ?? ''
  const sessionRediscovery = projectPhase.match(/const sessionResult[\s\S]*?(?=await assertPersistedAnchor)/)?.[0] ?? ''
  const projectArchiveRead = lifecycleSpec.match(/function readProjectArchived[\s\S]*?\n\}/)?.[0] ?? ''
  const seedFixturesIndex = projectPhase.indexOf('seedProjectSafetyFixtures(context.hermesHome, projectWorkspace)')
  const launchCandidateIndex = projectPhase.indexOf('running = await launchExactBinary(context)')
  const persistedReplyIndex = projectPhase.indexOf(
    'poll(() => readSessionSafetySnapshot(context.hermesHome).messageCount, { timeout: 30_000 })'
  )
  const seededSnapshotIndex = projectPhase.indexOf('const seeded = readSessionSafetySnapshot(context.hermesHome)')
  assert.ok(REQUIRED_LIFECYCLE_GATES.includes('projectSessionSafety'))
  assert.match(guestScript, /Invoke-PlaywrightPhase `\r?\n\s+'project-session-safety'/)
  assert.match(guestScript, /Add-Gate 'projectSessionSafety'/)
  assert.match(openProjectsHelper, /button\[data-sidebar="menu-button"\]/)
  assert.match(openProjectsHelper, /toHaveAccessibleName\(\/\^\(Projects\|Dự án\)\$\/i\)/)
  assert.match(openProjectsHelper, /projectsNavigation\.press\('Enter'\)/)
  assert.doesNotMatch(openProjectsHelper, /\.click\(\)/)
  assert.match(
    projectPhase,
    /seedProjectSafetyFixtures[\s\S]*?Open project\|Mở dự án[\s\S]*?data-sessions-project[\s\S]*?Control\+N/
  )
  assert.match(projectPhase, /page\.keyboard\.press\('Control\+N'\)/)
  assert.match(projectEntry, /getByRole\('button', \{ name: \/\^\(Open project\|Mở dự án\)\$\/i \}\)\.press\('Enter'\)/)
  assert.doesNotMatch(projectEntry, /getByRole\('button', \{ name: \/\^\(Open project\|Mở dự án\)\$\/i \}\)\.click\(\)/)
  assert.match(
    projectPhase,
    /Hide \$\{PROJECT_HIDE_NAME\} sessions\|Ẩn \$\{PROJECT_HIDE_NAME\} phiên[\s\S]*?\.press\('Enter'\)/
  )
  assert.match(
    projectPhase,
    /Show \$\{PROJECT_HIDE_NAME\} sessions\|Hiển thị \$\{PROJECT_HIDE_NAME\} phiên[\s\S]*?\.press\('Enter'\)/
  )
  assert.doesNotMatch(projectDisclosure, /\.click\(\)/)
  assert.match(
    projectPhase,
    /getByRole\('button', \{ name: \/\^\(All projects\|Tất cả dự án\)\/i \}\)\.press\('Enter'\)/
  )
  assert.doesNotMatch(
    projectPhase,
    /getByRole\('button', \{ name: \/\^\(All projects\|Tất cả dự án\)\/i \}\)\.click\(\)/
  )
  assert.ok(seedFixturesIndex >= 0, 'project fixtures must be seeded in the safety phase')
  assert.ok(launchCandidateIndex >= 0, 'candidate must launch in the project safety phase')
  assert.ok(seedFixturesIndex < launchCandidateIndex, 'project fixtures must be seeded before Hermes opens projects.db')
  assert.ok(persistedReplyIndex >= 0, 'project safety must wait for the reply to persist in state.db')
  assert.ok(seededSnapshotIndex >= 0, 'project safety must capture a persisted session snapshot')
  assert.ok(persistedReplyIndex < seededSnapshotIndex, 'the persisted message gate must precede the safety snapshot')
  assert.match(projectPhase, /not\.toContainText\(MOCK_REPLY/)
  assert.match(lifecycleSpec, /PROJECT_SESSION_MARKER = 'V321_PROJECT_SESSION_SAFETY_ANCHOR'/)
  assert.match(lifecycleSpec, /UPDATE sessions SET title = \?, title_source = 'user' WHERE id = \?/)
  assert.match(lifecycleSpec, /function setSessionSafetyTitle[\s\S]*?timeout: 250/)
  assert.match(
    lifecycleSpec,
    /function setSessionSafetyTitle[\s\S]*?database \(\?:table \)\?is locked\|database is busy/
  )
  assert.match(projectPhase, /expect\.poll\(\(\) => setSessionSafetyTitle[\s\S]*?timeout: 30_000/)
  assert.match(lifecycleSpec, /Hide from projects\|Ẩn khỏi danh sách dự án/)
  assert.match(projectMetadataActions, /Hide from projects\|Ẩn khỏi danh sách dự án[\s\S]*?\.press\('Enter'\)/)
  assert.match(projectMetadataActions, /remainingDeleteCard[\s\S]*?Delete\|Xóa[\s\S]*?\.press\('Enter'\)/)
  assert.match(projectMetadataActions, /const confirm[\s\S]*?Delete\|Xóa[\s\S]*?\.press\('Enter'\)/)
  assert.doesNotMatch(projectMetadataActions, /\.click\(\)/)
  assert.match(projectArchiveRead, /timeout: 250/)
  assert.match(projectArchiveRead, /database \(\?:table \)\?is locked\|database is busy/)
  assert.match(projectArchiveRead, /return PROJECT_DATABASE_BUSY/)
  assert.match(projectPhase, /expect\.poll\(\(\) => readProjectArchived/)
  assert.match(sessionRediscovery, /getByRole\('button', \{ name: new RegExp\(PROJECT_SESSION_TITLE, 'i'\) \}\)/)
  assert.match(sessionRediscovery, /toHaveAccessibleName\(new RegExp\(PROJECT_SESSION_TITLE, 'i'\)\)/)
  assert.match(sessionRediscovery, /sessionResult\.press\('Enter'\)/)
  assert.doesNotMatch(sessionRediscovery, /\.click\(\)/)
  assert.match(lifecycleSpec, /projectDeleteRemoved/)
  assert.match(lifecycleSpec, /messageDigest/)
  assert.match(lifecycleSpec, /not\.toBe\('project'\)/)
})

test('GUI uninstall opens Settings through its global shortcut and activates exact accessible controls', () => {
  const uninstallHelper = lifecycleSpec.match(/async function openGuiUninstall[\s\S]*?\r?\n\}/)?.[0] ?? ''
  const activationHelper = lifecycleSpec.match(/async function activateTopmostVisibleButton[\s\S]*?\r?\n\}/)?.[0] ?? ''
  assert.match(uninstallHelper, /await page\.keyboard\.press\('Control\+,'\)/)
  assert.match(uninstallHelper, /activateTopmostVisibleButton\(page, \/\^\(About\|Giới thiệu\)\$\/i\)/)
  assert.match(uninstallHelper, /activateTopmostVisibleButton\(page, optionName, 60_000\)/)
  assert.doesNotMatch(uninstallHelper, /Open settings|Mở cài đặt/)
  assert.match(activationHelper, /document\.elementFromPoint/)
  assert.match(activationHelper, /const element = await button\.elementHandle\(\)/)
  assert.match(activationHelper, /await element\.scrollIntoViewIfNeeded\(\)/)
  assert.match(activationHelper, /node\.contains\(hitTarget\)/)
  assert.match(activationHelper, /await element\.press\('Enter'\)/)
  assert.doesNotMatch(activationHelper, /mouse\.click|element\.click|button\.click|locator\.click/)
  assert.doesNotMatch(activationHelper, /hitTargetIndex|buttons\.nth\(hitTargetIndex\)/)
  assert.doesNotMatch(activationHelper, /dispatchEvent|evaluate\([^)]*\.click/)
})

test('safe tool-loop phases expose only the built-in todo toolset', () => {
  assert.match(
    lifecycleSpec,
    /context\.action === 'safe-tool' \|\| context\.action === 'verify-update'[\s\S]*?HERMES_TUI_TOOLSETS: 'todo'/
  )
  assert.doesNotMatch(lifecycleSpec, /HERMES_TUI_TOOLSETS: '(?:all|\*)'/)
})

test('mock safe tool loop follows the exact advertised lean bridge schema', async () => {
  restartMockServer()
  const mock = await startMockServer()

  try {
    const response = await fetch(`${mock.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'E2E_INTERIM_TRIGGER' }],
        model: 'mock-model',
        stream: false,
        tools: [
          {
            type: 'function',
            function: {
              name: 'tool_call',
              parameters: { type: 'object' }
            }
          }
        ]
      })
    })

    assert.equal(response.status, 200)
    const payload = await response.json()
    const call = payload.choices[0].message.tool_calls[0]
    const args = JSON.parse(call.function.arguments)
    assert.equal(call.function.name, 'tool_call')
    assert.equal(args.name, 'todo')
    assert.deepEqual(args.arguments, {
      todos: [{ id: '1', content: 'Plan', status: 'in_progress' }]
    })
  } finally {
    await mock.close()
  }
})

test('sandbox configuration disables host-facing channels and maps only evidence writable', () => {
  const xml = buildWindowsSandboxConfig({
    evidenceDir: 'C:\\Evidence & Results',
    inputDir: 'C:\\Input',
    nodeRuntimeDir: 'C:\\Node26',
    repoSnapshotDir: 'C:\\TrackedRepo'
  })

  assert.match(xml, /<Networking>Disable<\/Networking>/)
  assert.match(xml, /<ClipboardRedirection>Disable<\/ClipboardRedirection>/)
  assert.match(xml, /<ProtectedClient>Enable<\/ProtectedClient>/)
  assert.match(xml, /C:\\Evidence &amp; Results/)
  assert.equal((xml.match(/<ReadOnly>true<\/ReadOnly>/g) || []).length, 3)
  assert.equal((xml.match(/<ReadOnly>false<\/ReadOnly>/g) || []).length, 1)
  assert.match(xml, /WDAGUtilityAccount\\Desktop|C:\\HermesHarness/)
})

test('receipt validation requires every gate and exact artifact identity', () => {
  const gates = Object.fromEntries(
    REQUIRED_LIFECYCLE_GATES.map(name => [
      name,
      {
        detail:
          name === 'v32ToV321Update' || name === 'rollbackVi39'
            ? { sameRegisteredInstallDir: true }
            : name === 'networkIsolation'
              ? { mode: 'disabled' }
              : {},
        evidence: [`${name}.log`],
        status: 'passed'
      }
    ])
  )
  const receipt = {
    artifacts: { candidate, previous, rollback },
    evidenceManifest: REQUIRED_LIFECYCLE_GATES.map(name => ({
      path: `${name}.log`,
      sha256: '5'.repeat(64),
      size: 1234
    })),
    gates,
    harnessCommit: descriptor.harnessCommit,
    isolation: {
      guestUser: 'WDAGUtilityAccount',
      hostRegistryReachable: false,
      mechanism: 'windows-sandbox',
      networkMode: 'disabled',
      productOutboundBlocked: true,
      registryProbe: {
        currentHiveMatchesGuestSid: true,
        foreignInteractiveUserHiveCount: 0,
        kind: 'loaded-user-hives-and-volatile-profile',
        volatileProfileIsDisposableGuest: true
      }
    },
    runId: descriptor.runId,
    schemaVersion: 1,
    status: 'passed'
  }

  assert.equal(validateLifecycleReceipt(receipt, descriptor).receipt, receipt)
  const hostedReceipt = {
    ...receipt,
    gates: {
      ...gates,
      networkIsolation: {
        ...gates.networkIsolation,
        detail: {
          firewallRuleCount: 6,
          mode: 'product-firewall',
          scopes: ['Internet', 'LocalSubnet']
        }
      }
    },
    isolation: {
      ephemeralVm: true,
      firewallRuleCount: 8,
      guestUser: 'runneradmin',
      hostRegistryReachable: false,
      hypervisorBoundary: true,
      mechanism: 'github-hosted-ephemeral-vm',
      networkMode: 'product-firewall',
      productOutboundBlocked: true,
      registryProbe: {
        currentHiveMatchesGuestSid: true,
        foreignInteractiveUserHiveCount: 0,
        kind: 'github-hosted-ephemeral-vm',
        volatileProfileIsCurrentRunner: true
      }
    }
  }
  assert.equal(validateLifecycleReceipt(hostedReceipt, descriptor).receipt, hostedReceipt)
  assert.throws(
    () =>
      validateLifecycleReceipt(
        {
          ...hostedReceipt,
          isolation: { ...hostedReceipt.isolation, productOutboundBlocked: false }
        },
        descriptor
      ),
    /product-firewall boundary/
  )
  assert.throws(
    () => validateLifecycleReceipt({ ...receipt, gates: { ...gates, repair: { status: 'skipped' } } }, descriptor),
    /repair is not passed/
  )
  assert.throws(
    () =>
      validateLifecycleReceipt(
        {
          ...receipt,
          gates: {
            ...gates,
            rollbackVi39: { ...gates.rollbackVi39, detail: { sameRegisteredInstallDir: false } }
          }
        },
        descriptor
      ),
    /rollbackVi39 did not prove an in-place/
  )
  assert.throws(
    () =>
      validateLifecycleReceipt(
        {
          ...receipt,
          artifacts: { ...receipt.artifacts, candidate: { ...candidate, sha256: '4'.repeat(64) } }
        },
        descriptor
      ),
    /candidate\.sha256 mismatch/
  )
  assert.throws(
    () => validateLifecycleReceipt({ ...receipt, evidenceManifest: [] }, descriptor),
    /non-empty evidence manifest/
  )
  assert.throws(
    () =>
      validateLifecycleReceipt(
        {
          ...receipt,
          evidenceManifest: [{ path: '../host.txt', sha256: '5'.repeat(64), size: 1234 }]
        },
        descriptor
      ),
    /normalized relative evidence path/
  )
})
