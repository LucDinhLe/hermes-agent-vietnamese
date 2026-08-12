import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { test } from 'vitest'

const workflow = readFileSync(
  new URL('../../../.github/workflows/release-vietnamese.yml', import.meta.url),
  'utf8'
)

test('keeps unsigned macOS community builds from treating a blank certificate as a path', () => {
  assert.match(workflow, /if: matrix\.platform == 'darwin'/)
  assert.match(workflow, /unset CSC_LINK CSC_KEY_PASSWORD APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER/)
  assert.match(workflow, /export CSC_IDENTITY_AUTO_DISCOVERY=false/)
})

test('does not expose macOS signing variables to Windows or Linux builds', () => {
  assert.match(workflow, /Đóng gói Windows hoặc Linux\n\s+if: matrix\.platform != 'darwin'/)
})
