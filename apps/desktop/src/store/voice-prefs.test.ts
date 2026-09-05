import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HermesConnection } from '@/global'

const { getHermesConfigRecord, saveHermesConfig } = vi.hoisted(() => ({
  getHermesConfigRecord: vi.fn(async () => ({})),
  saveHermesConfig: vi.fn(async () => undefined)
}))

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getHermesConfigRecord,
  saveHermesConfig
}))

import { $activeGatewayProfile } from './profile'
import { $connection } from './session'
import { $autoSpeakReplies, $voiceStopPhrase, applyVoiceStopPhraseFromConfig, setAutoSpeakReplies } from './voice-prefs'

beforeEach(() => {
  vi.clearAllMocks()
  $autoSpeakReplies.set(false)
  $activeGatewayProfile.set('default')
  $connection.set({ connectionId: 'local', mode: 'local', profile: 'default' } as HermesConnection)
})

describe('applyVoiceStopPhraseFromConfig', () => {
  it('defaults to "stop" when the key is absent (backend default applies)', () => {
    applyVoiceStopPhraseFromConfig({ voice: {} })
    expect($voiceStopPhrase.get()).toBe('stop')

    applyVoiceStopPhraseFromConfig(null)
    expect($voiceStopPhrase.get()).toBe('stop')
  })

  it('uses the first configured phrase so a custom phrase renders correctly', () => {
    applyVoiceStopPhraseFromConfig({ voice: { stop_phrases: ['goodbye hermes', 'stop'] } })
    expect($voiceStopPhrase.get()).toBe('goodbye hermes')
  })

  it('coerces a bare string like the backend does', () => {
    applyVoiceStopPhraseFromConfig({ voice: { stop_phrases: 'halt' } })
    expect($voiceStopPhrase.get()).toBe('halt')
  })

  it('null phrase when stop phrases are disabled — no notice is shown', () => {
    applyVoiceStopPhraseFromConfig({ voice: { stop_phrases: [] } })
    expect($voiceStopPhrase.get()).toBeNull()
  })

  it('malformed entries are skipped; all-blank list disables', () => {
    applyVoiceStopPhraseFromConfig({ voice: { stop_phrases: ['  ', ''] } })
    expect($voiceStopPhrase.get()).toBeNull()
  })
})

describe('setAutoSpeakReplies', () => {
  it('keeps a whole-config write on the captured source after a same-profile switch', async () => {
    let finishRead: ((value: { voice: { speed: number } }) => void) | undefined
    getHermesConfigRecord.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishRead = resolve
        })
    )
    $connection.set({ connectionId: 'source-a', mode: 'remote', profile: 'default' } as HermesConnection)

    const saving = setAutoSpeakReplies(true)
    await Promise.resolve()
    $connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'default' } as HermesConnection)
    finishRead?.({ voice: { speed: 1 } })
    await saving

    expect(getHermesConfigRecord).toHaveBeenCalledWith('default', 'source-a')
    expect(saveHermesConfig).toHaveBeenCalledWith({ voice: { auto_tts: true, speed: 1 } }, 'default', 'source-a')
  })
})
