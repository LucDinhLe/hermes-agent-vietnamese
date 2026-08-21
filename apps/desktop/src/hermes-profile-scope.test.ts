import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authMcpServer,
  checkHermesUpdate,
  deleteProfile,
  getActionStatus,
  getElevenLabsVoices,
  getEnvVars,
  getHermesConfigRecord,
  getLogs,
  getMcpCatalog,
  getMcpOAuthFlow,
  getMemoryProviderConfig,
  getProfiles,
  getSkillHubSources,
  getSkills,
  getStatus,
  getToolsets,
  getUsageAnalytics,
  installSkillFromHub,
  pollOAuthSession,
  restartGateway,
  runDoctor,
  saveHermesConfig,
  saveMcpServers,
  saveMemoryProviderConfig,
  setApiRequestConnection,
  setApiRequestProfile,
  setEnvVar,
  setSkillEnabled,
  setToolsetEnabled,
  speakText,
  startGateway,
  startOAuthLogin,
  stopGateway,
  transcribeAudio,
  updateHermes
} from './hermes'

// Contract: every backend-targeted action helper must carry the active gateway
// profile, so a multi-profile / global-remote user's restart, status poll, and
// update hit the backend they're actually on — not the primary/default. The
// System-panel "restart does nothing" bug was these helpers dropping it.
describe('backend action helpers are profile-scoped', () => {
  const api = vi.fn(
    async (_req: { path: string; profile?: string; connectionId?: string; method?: string }) => ({}) as never
  )

  beforeEach(() => {
    ;(window as { hermesDesktop?: unknown }).hermesDesktop = { api }
    api.mockClear()
  })

  afterEach(() => {
    setApiRequestProfile(null)
    setApiRequestConnection(null)
    delete (window as { hermesDesktop?: unknown }).hermesDesktop
  })

  const lastProfile = () => api.mock.calls.at(-1)?.[0].profile

  it('omits profile when none is active (single-profile users unaffected)', () => {
    void getStatus()
    expect(lastProfile()).toBeUndefined()
  })

  it('forwards the active profile to memory provider config calls', () => {
    setApiRequestProfile('coder')

    void getMemoryProviderConfig('honcho')
    void saveMemoryProviderConfig('honcho', { workspace: 'w' })

    for (const call of api.mock.calls) {
      expect(call[0].profile).toBe('coder')
    }
  })

  it('forwards the active profile to every backend action', () => {
    setApiRequestProfile('coder')

    void getStatus()
    void restartGateway()
    void updateHermes()
    void checkHermesUpdate()
    void getActionStatus('gateway-restart')

    for (const call of api.mock.calls) {
      expect(call[0].profile).toBe('coder')
    }
  })

  // Audio endpoints (transcribe / speak / voices) write to the active
  // profile's config in the settings UI but historically called the backend
  // without a profile scope, so playback used the default profile's TTS/voice
  // config instead of the active one (#53441).
  it('forwards the active profile to audio endpoints', () => {
    setApiRequestProfile('jarvis')

    void transcribeAudio('data:audio/webm;base64,AAAA', 'audio/webm')
    void speakText('hello')
    void getElevenLabsVoices()

    expect(api.mock.calls).toHaveLength(3)

    for (const call of api.mock.calls) {
      expect(call[0].profile).toBe('jarvis')
    }
  })

  it('forwards the active remote source to representative capability reads and writes', () => {
    setApiRequestProfile('researcher')
    setApiRequestConnection('source-remote')

    void getHermesConfigRecord('researcher')
    void saveHermesConfig({}, 'researcher')
    void getEnvVars('researcher')
    void setEnvVar('API_KEY', 'secret', 'researcher')
    void getSkills('researcher')
    void setSkillEnabled('web-research', true, 'researcher')
    void getToolsets('researcher')
    void setToolsetEnabled('browser', true, 'researcher')
    void getUsageAnalytics(30, 'researcher')
    void getSkillHubSources('researcher')
    void installSkillFromHub('owner/skill', 'researcher')
    void getMcpCatalog('researcher')
    void saveMcpServers({ filesystem: { command: 'server' } }, 'researcher')
    void getActionStatus('install-skill', 1, 'researcher')
    void getProfiles('source-remote')

    expect(api.mock.calls).toHaveLength(15)

    for (const call of api.mock.calls) {
      expect(call[0].connectionId).toBe('source-remote')
    }

    expect(api.mock.calls.at(-1)?.[0].profile).toBeUndefined()
  })

  it('keeps the legacy profile manager inventory unscoped unless a source is explicit', () => {
    setApiRequestConnection('source-remote')

    void getProfiles()

    expect(api.mock.calls[0][0]).toMatchObject({ path: '/api/profiles' })
    expect(api.mock.calls[0][0].connectionId).toBeUndefined()
  })

  it('lets an explicit null connection opt out of the ambient remote source', () => {
    setApiRequestProfile('researcher')
    setApiRequestConnection('source-remote')

    void getSkills('researcher', null)

    expect(api.mock.calls[0][0]).toMatchObject({ path: '/api/skills', profile: 'researcher' })
    expect(api.mock.calls[0][0].connectionId).toBeUndefined()
  })

  it('preserves an explicit local source while the ambient primary is remote', () => {
    setApiRequestProfile('researcher')
    setApiRequestConnection('remote-primary')

    void getSkills('researcher', 'local')
    void getLogs({ file: 'mcp' }, 'researcher', 'local')

    expect(api.mock.calls).toHaveLength(2)

    for (const call of api.mock.calls) {
      expect(call[0]).toMatchObject({ connectionId: 'local', profile: 'researcher' })
    }
  })

  it('pins every gateway header request to the captured backend owner', () => {
    setApiRequestProfile('ambient')
    setApiRequestConnection('source-b')

    void getStatus('researcher', 'source-a')
    void getLogs({ file: 'gateway' }, 'researcher', 'source-a')
    void startGateway('researcher', 'source-a')
    void restartGateway('researcher', 'source-a')
    void stopGateway('researcher', 'source-a')
    void runDoctor('researcher', 'source-a')

    expect(api.mock.calls.map(call => call[0].path)).toEqual([
      '/api/status',
      '/api/logs?file=gateway',
      '/api/gateway/start',
      '/api/gateway/restart',
      '/api/gateway/stop',
      '/api/ops/doctor'
    ])

    for (const call of api.mock.calls) {
      expect(call[0]).toMatchObject({ connectionId: 'source-a', profile: 'researcher' })
    }

    for (const call of api.mock.calls.slice(2)) {
      expect(call[0].method).toBe('POST')
    }
  })

  it('pins profile deletion to the captured registry source', () => {
    setApiRequestConnection('source-b')

    void deleteProfile('researcher', 'source-a')
    void deleteProfile('writer', 'local')

    expect(api.mock.calls[0][0]).toMatchObject({
      connectionId: 'source-a',
      method: 'DELETE',
      path: '/api/profiles/researcher'
    })
    expect(api.mock.calls[1][0]).toMatchObject({
      connectionId: 'local',
      method: 'DELETE',
      path: '/api/profiles/writer'
    })
  })

  it('keeps a captured source immutable across OAuth start and poll calls', () => {
    setApiRequestProfile('researcher')
    setApiRequestConnection('source-a')

    void startOAuthLogin('nous', 'researcher', 'source-a')
    void authMcpServer('github', 'researcher', 'source-a')

    setApiRequestConnection('source-b')

    void pollOAuthSession('nous', 'provider-flow', 'researcher', 'source-a')
    void getMcpOAuthFlow('mcp-flow', 'researcher', 'source-a')

    expect(api.mock.calls).toHaveLength(4)

    for (const call of api.mock.calls) {
      expect(call[0]).toMatchObject({ connectionId: 'source-a', profile: 'researcher' })
    }
  })
})
