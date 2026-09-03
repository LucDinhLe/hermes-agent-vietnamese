import { expect, test } from 'vitest'
import { windowsNumericVersion } from './set-exe-identity.mjs'

test('stamps the package calendar version, not a hardcoded legacy number', () => {
  expect(windowsNumericVersion('2026.9.2')).toBe('2026.9.2.0')
  expect(windowsNumericVersion('2026.10.1')).toBe('2026.10.1.0')
  expect(windowsNumericVersion('0.33.0-dev.14-advisor-exp.14')).toBe('0.33.0.14')
  expect(() => windowsNumericVersion('2026.9.65536')).toThrow()
  expect(() => windowsNumericVersion('not-a-version')).toThrow()
})
