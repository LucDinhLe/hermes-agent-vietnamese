#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { _electron } from '@playwright/test'

function parseArgs(argv) {
  const values = new Map()

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]

    if (!key?.startsWith('--') || !value) throw new Error(`invalid argument near ${key ?? '(end)'}`)
    values.set(key.slice(2), value)
  }

  for (const key of ['binary', 'home', 'user-data', 'screenshot', 'result', 'phase']) {
    if (!values.has(key)) throw new Error(`--${key} is required`)
  }

  return Object.fromEntries(values)
}

function assertWithin(root, candidate, label) {
  const relative = path.win32.relative(path.win32.resolve(root), path.win32.resolve(candidate))

  if (!relative || relative === '..' || relative.startsWith(`..${path.win32.sep}`) || path.win32.isAbsolute(relative)) {
    throw new Error(`${label} escaped ${root}`)
  }
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function cleanEnvironment(overrides) {
  const denied = /(?:api[_-]?key|token|secret|password|credential|cookie|authorization)/i
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name, value]) => value !== undefined && !denied.test(name))
  )

  for (const name of [
    'HERMES_DESKTOP_DEV_SERVER',
    'HERMES_DESKTOP_HERMES',
    'HERMES_DESKTOP_HERMES_ROOT',
    'OPENAI_BASE_URL',
    'ANTHROPIC_BASE_URL'
  ]) {
    delete environment[name]
  }

  return { ...environment, ...overrides }
}

async function main() {
  if (
    process.platform !== 'win32' ||
    process.arch !== 'x64' ||
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
    process.env.RUNNER_OS !== 'Windows'
  ) {
    throw new Error('installed smoke is restricted to a GitHub-hosted Windows x64 VM')
  }

  const args = parseArgs(process.argv.slice(2))
  const binary = path.win32.resolve(args.binary)
  const hermesHome = path.win32.resolve(args.home)
  const userData = path.win32.resolve(args['user-data'])
  const screenshot = path.win32.resolve(args.screenshot)
  const result = path.win32.resolve(args.result)

  assertWithin('C:\\HermesLifecycle', hermesHome, 'HERMES_HOME')
  assertWithin('C:\\HermesLifecycle', userData, 'Electron userData')
  assertWithin('C:\\HermesEvidence', screenshot, 'screenshot')
  assertWithin('C:\\HermesEvidence', result, 'result')

  if (!fs.statSync(binary, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`installed Hermes binary is missing: ${binary}`)
  }

  fs.mkdirSync(hermesHome, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.mkdirSync(path.dirname(screenshot), { recursive: true })
  fs.mkdirSync(path.dirname(result), { recursive: true })

  const workspace = path.join(hermesHome, 'workspace')
  fs.mkdirSync(workspace, { recursive: true })

  const app = await _electron.launch({
    executablePath: binary,
    args: ['--disable-gpu', '--no-sandbox'],
    env: cleanEnvironment({
      HERMES_DESKTOP_APP_NAME: `HermesV33Lifecycle-${args.phase}`,
      HERMES_DESKTOP_BOOT_FAKE: '1',
      HERMES_DESKTOP_BOOT_FAKE_STEP_MS: '80',
      HERMES_DESKTOP_CWD: workspace,
      HERMES_DESKTOP_IGNORE_EXISTING: '1',
      HERMES_DESKTOP_USER_DATA_DIR: userData,
      HERMES_HOME: hermesHome,
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost'
    })
  })

  try {
    const page = await app.firstWindow()
    await page.waitForSelector('#root', { state: 'attached', timeout: 60_000 })
    await page.waitForFunction(() => (document.querySelector('#root')?.children.length ?? 0) > 0, undefined, {
      timeout: 60_000
    })
    await page.waitForFunction(
      () => {
        const text = document.body.textContent?.toLowerCase() ?? ''
        return !['starting', 'resolving', 'spawning', 'waiting', 'installing'].some((word) => text.includes(word))
      },
      undefined,
      { timeout: 90_000 }
    )

    const title = await page.title()
    if (!title.includes('Hermes Vietnamese')) {
      throw new Error(`installed renderer title is not branded: ${title}`)
    }

    const rootChildCount = await page.locator('#root > *').count()
    if (rootChildCount < 1) throw new Error('installed renderer root is empty')

    await page.screenshot({ path: screenshot, fullPage: true })
    fs.writeFileSync(
      result,
      `${JSON.stringify(
        {
          binary,
          binarySha256: sha256(binary),
          phase: args.phase,
          rootChildCount,
          screenshot,
          title
        },
        null,
        2
      )}\n`,
      'utf8'
    )
  } finally {
    await app.close().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
