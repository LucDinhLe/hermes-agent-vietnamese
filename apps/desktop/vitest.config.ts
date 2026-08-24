import type { TestProjectConfiguration } from 'vitest/config'
import { defineConfig } from 'vitest/config'

// Windows/OneDrive cold module transforms are materially slower than Linux
// CI. Keep the tighter timeout elsewhere while avoiding false negatives on
// the supported Windows release host.
const uiTestTimeout = process.platform === 'win32' ? 60_000 : 15_000
const electronTestTimeout = process.platform === 'win32' ? 30_000 : 15_000

const reactUi: TestProjectConfiguration = {
  extends: './vite.config.ts',
  test: {
    name: 'ui',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    // The first test in each file pays jsdom env init + full module transform,
    // which can exceed vitest's 5000ms default under CI/load. 15s gives the
    // cold start headroom without masking genuinely hung tests.
    testTimeout: uiTestTimeout
  }
}

const electronNative: TestProjectConfiguration = {
  test: {
    name: 'electron',
    environment: 'node',
    include: ['electron/**/*.test.ts', 'scripts/**.test.{ts,mjs}'],
    testTimeout: electronTestTimeout,
    exclude: ['scripts/run-short-session-hang-repro.test.mjs', 'scripts/patch-electron-builder-mac-binary.test.mjs']
  }
}

export default defineConfig({
  test: {
    projects: [reactUi, electronNative]
  }
})
