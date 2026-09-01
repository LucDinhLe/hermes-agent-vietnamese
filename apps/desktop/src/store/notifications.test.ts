import { JsonRpcGatewayError } from '@hermes/shared'
import { beforeEach, expect, test } from 'vitest'

import { SESSION_RUNTIME_RECOVERY_MESSAGE } from '@/app/session/session-binding-registry'

import { $notifications, clearNotifications, isDiskFullErrorMessage, notifyError } from './notifications'

beforeEach(() => {
  clearNotifications()
})

function lastMessage(): string {
  return $notifications.get()[0]?.message ?? ''
}

// Regression for #39365: a gateway auth 401 (bad API_SERVER_KEY) must not be
// summarized as a provider (OpenAI/OpenRouter) API key problem.
test('gateway_auth_failed error is summarized as gateway auth, not provider key', () => {
  notifyError(
    new Error(
      '401 {"error": {"message": "Invalid gateway API key (API_SERVER_KEY)", "type": "gateway_auth_error", "code": "gateway_auth_failed"}}'
    ),
    'Request failed'
  )

  expect(lastMessage()).toContain('API_SERVER_KEY')
  expect(lastMessage()).not.toMatch(/OpenAI/i)
})

test('provider invalid_api_key error still maps to the OpenAI summary', () => {
  notifyError(
    new Error('401 {"error": {"message": "Incorrect API key provided", "code": "invalid_api_key"}}'),
    'Request failed'
  )

  expect(lastMessage()).toMatch(/OpenAI rejected the API key/i)
})

test('disk-full / ENOSPC errors toast a free-space message', () => {
  expect(isDiskFullErrorMessage('OSError: [Errno 28] No space left on device')).toBe(true)
  expect(isDiskFullErrorMessage('sqlite3.OperationalError: database or disk is full')).toBe(true)
  expect(isDiskFullErrorMessage('disk full: session storage could not be written — free some disk space')).toBe(true)
  expect(isDiskFullErrorMessage('This is often a full disk — free some space')).toBe(true)
  expect(isDiskFullErrorMessage('session storage could not be written: permission denied')).toBe(false)
  expect(isDiskFullErrorMessage('network timeout')).toBe(false)

  notifyError(new Error('OSError: [Errno 28] No space left on device: state.db'), 'Prompt failed')

  expect(lastMessage()).toMatch(/Disk full/i)
  expect(lastMessage()).toMatch(/free some space/i)
})

test('session storage write failure is treated as disk-full class', () => {
  notifyError(
    new Error('disk full: session storage could not be written — free some disk space and try again'),
    'Prompt failed'
  )

  expect(lastMessage()).toMatch(/Disk full/i)
})

test('structural runtime-not-found notifications never expose raw backend text or code', () => {
  notifyError(
    new JsonRpcGatewayError('SECRET raw backend diagnostic must stay hidden', { code: 4007 }),
    'Prompt failed'
  )

  const notification = $notifications.get()[0]

  expect(notification?.message).toBe(SESSION_RUNTIME_RECOVERY_MESSAGE)
  expect(notification?.detail).toBeUndefined()
  expect(notification?.message).not.toMatch(/SECRET|4007/)
})

test.each(['GatewaySocketEpochMismatchError', 'RendererRuntimeEpochMismatchError'])(
  'structural %s notifications use the same sanitized recovery message',
  name => {
    const error = new Error('SECRET stale epoch diagnostic')
    error.name = name

    notifyError(error, 'Prompt failed')

    expect($notifications.get()[0]).toMatchObject({
      detail: undefined,
      message: SESSION_RUNTIME_RECOVERY_MESSAGE
    })
  }
)
