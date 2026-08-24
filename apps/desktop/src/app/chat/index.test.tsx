import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assistantTextPart, type ChatMessage } from '@/lib/chat-messages'
import { $showAllProfiles } from '@/store/profile'
import { $projectTree, $projectTreeOwner } from '@/store/projects'
import {
  $activeSessionId,
  $awaitingResponse,
  $busy,
  $connection,
  $contextSuggestions,
  $currentCwd,
  $currentModel,
  $currentProvider,
  $freshDraftReady,
  $gatewayState,
  $messages,
  $selectedStoredSessionId,
  $sessions
} from '@/store/session'
import { clearAllSessionStates, recordPrimarySessionEventSource, recordSessionEventScope } from '@/store/session-states'

const threadRenderCount = vi.hoisted(() => ({ current: 0 }))
const advisorRender = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))

vi.mock('@/components/assistant-ui/thread', async () => {
  const React = await import('react')

  return {
    Thread: () => {
      threadRenderCount.current += 1

      return React.createElement('div', { 'data-testid': 'thread' })
    }
  }
})

vi.mock('@/components/Backdrop', async () => {
  const React = await import('react')

  return { Backdrop: () => React.createElement('div', { 'data-testid': 'backdrop' }) }
})

vi.mock('@/components/prompt-overlays', () => ({ PromptOverlays: () => null }))
vi.mock('@/components/chat/vibe-hearts', () => ({ COMPOSER_HEART_CONFIG: {}, HeartField: () => null }))
vi.mock('@/lib/model-options', () => ({
  modelOptionsQueryKey: (...parts: unknown[]) => ['model-options', ...parts],
  requestModelOptions: vi.fn(async () => ({ models: [] }))
}))
vi.mock('./chat-drop-overlay', () => ({ ChatDropOverlay: () => null }))
vi.mock('./chat-swap-overlay', () => ({ ChatSwapOverlay: () => null }))
vi.mock('./composer', () => ({ ChatBar: () => null, ChatBarFallback: () => null }))
vi.mock('./session-advisor-bar', () => ({
  SessionAdvisorBar: (props: Record<string, unknown>) => {
    advisorRender.current = props

    return null
  }
}))
vi.mock('./hooks/use-file-drop-zone', () => ({
  useFileDropZone: () => ({ dragKind: null, dropHandlers: {} })
}))
vi.mock('./sidebar/session-actions-menu', async () => {
  const React = await import('react')

  return {
    SessionActionsMenu: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'session-actions-menu' }, children)
  }
})

const { ChatView } = await import('./index')

function assistantMessage(id: string, text: string): ChatMessage {
  return {
    id,
    parts: [assistantTextPart(text)],
    role: 'assistant'
  }
}

describe('ChatView render isolation', () => {
  beforeEach(() => {
    clearAllSessionStates()
    advisorRender.current = null
    threadRenderCount.current = 0
    $activeSessionId.set('runtime-1')
    $awaitingResponse.set(false)
    $busy.set(false)
    $contextSuggestions.set([])
    $connection.set({ connectionId: 'local', mode: 'local' } as never)
    $currentCwd.set('/work')
    $currentModel.set('test-model')
    $currentProvider.set('test-provider')
    $freshDraftReady.set(false)
    $gatewayState.set('closed')
    $messages.set([assistantMessage('assistant-1', 'Stable historical answer')])
    $projectTree.set([])
    $projectTreeOwner.set(null)
    $showAllProfiles.set(false)
    $selectedStoredSessionId.set('stored-1')
    $sessions.set([{ id: 'stored-1', message_count: 1, title: 'Stable chat' } as never])
    recordPrimarySessionEventSource({ session_id: 'runtime-1' }, $connection.get())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    advisorRender.current = null
    $activeSessionId.set(null)
    $awaitingResponse.set(false)
    $busy.set(false)
    $contextSuggestions.set([])
    $connection.set(null)
    $currentCwd.set('')
    $currentModel.set('')
    $currentProvider.set('')
    $freshDraftReady.set(false)
    $gatewayState.set('idle')
    $messages.set([])
    $projectTree.set([])
    $projectTreeOwner.set(null)
    $showAllProfiles.set(false)
    $selectedStoredSessionId.set(null)
    $sessions.set([])
    clearAllSessionStates()
  })

  it('does not re-render chat history when an unrelated parent idle tick updates', () => {
    const props = {
      gateway: null,
      maxVoiceRecordingSeconds: 120,
      onAddContextRef: vi.fn(),
      onAddUrl: vi.fn(),
      onAttachDroppedItems: vi.fn(),
      onAttachImageBlob: vi.fn(),
      onBranchInNewChat: vi.fn(),
      onCancel: vi.fn(),
      onDeleteSelectedSession: vi.fn(),
      onEdit: vi.fn(),
      onPasteClipboardImage: vi.fn(),
      onPickFiles: vi.fn(),
      onPickFolders: vi.fn(),
      onPickImages: vi.fn(),
      onReload: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onRetryResume: vi.fn(),
      onSteer: vi.fn(),
      onSubmit: vi.fn(),
      onThreadMessagesChange: vi.fn(),
      onToggleSelectedPin: vi.fn(),
      onTranscribeAudio: vi.fn()
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })

    function ParentTickHarness() {
      const [tick, setTick] = useState(0)

      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/stored-1']}>
            <button onClick={() => setTick(value => value + 1)} type="button">
              parent tick {tick}
            </button>
            <ChatView {...props} />
          </MemoryRouter>
        </QueryClientProvider>
      )
    }

    render(<ParentTickHarness />)

    expect(screen.getByTestId('thread')).toBeTruthy()
    expect(threadRenderCount.current).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /parent tick/i }))

    // memo(ChatView) with stable props must absorb the parent's idle tick —
    // the transcript (Thread) must not re-render. This is PR #38470's contract.
    expect(threadRenderCount.current).toBe(1)
  })

  it('waits for a stable project id and reacts when the project tree hydrates', () => {
    $currentCwd.set('C:\\Repos\\App\\src')

    const props = {
      gateway: null,
      maxVoiceRecordingSeconds: 120,
      onAddContextRef: vi.fn(),
      onAddUrl: vi.fn(),
      onAttachDroppedItems: vi.fn(),
      onAttachImageBlob: vi.fn(),
      onBranchInNewChat: vi.fn(),
      onCancel: vi.fn(),
      onDeleteSelectedSession: vi.fn(),
      onEdit: vi.fn(),
      onPasteClipboardImage: vi.fn(),
      onPickFiles: vi.fn(),
      onPickFolders: vi.fn(),
      onPickImages: vi.fn(),
      onReload: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onRetryResume: vi.fn(),
      onSteer: vi.fn(),
      onSubmit: vi.fn(),
      onThreadMessagesChange: vi.fn(),
      onToggleSelectedPin: vi.fn(),
      onTranscribeAudio: vi.fn()
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/stored-1']}>
          <ChatView {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // A cwd is deliberately not exposed as a project persistence key while
    // projects.tree is still loading.
    expect(advisorRender.current?.projectKey).toBe('')

    act(() => {
      $projectTree.set([
        {
          id: 'project-app',
          label: 'App',
          path: 'C:\\Repos\\App',
          repos: [],
          sessionCount: 1
        }
      ])
      $projectTreeOwner.set({ connectionId: 'local', profile: 'default', scope: 'profile' })
    })

    expect(advisorRender.current?.projectKey).toBe('project-app')
  })

  it('passes the runtime session source instead of the globally active connection', () => {
    $connection.set({ connectionId: 'homelab', mode: 'remote' } as never)
    recordSessionEventScope({ connectionId: 'homelab', profile: 'remote-lead', session_id: 'runtime-1' })
    $sessions.set([{ id: 'stored-1', message_count: 1, profile: 'remote-lead', title: 'Remote stable chat' } as never])

    const props = {
      gateway: null,
      maxVoiceRecordingSeconds: 120,
      onAddContextRef: vi.fn(),
      onAddUrl: vi.fn(),
      onAttachDroppedItems: vi.fn(),
      onAttachImageBlob: vi.fn(),
      onBranchInNewChat: vi.fn(),
      onCancel: vi.fn(),
      onDeleteSelectedSession: vi.fn(),
      onEdit: vi.fn(),
      onPasteClipboardImage: vi.fn(),
      onPickFiles: vi.fn(),
      onPickFolders: vi.fn(),
      onPickImages: vi.fn(),
      onReload: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onRetryResume: vi.fn(),
      onSteer: vi.fn(),
      onSubmit: vi.fn(),
      onThreadMessagesChange: vi.fn(),
      onToggleSelectedPin: vi.fn(),
      onTranscribeAudio: vi.fn()
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/stored-1']}>
          <ChatView {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(advisorRender.current?.leadConnectionId).toBe('homelab')
    expect(advisorRender.current?.gatewayConnectionId).toBe('homelab')
    expect(advisorRender.current?.leadProfile).toBe('remote-lead')
  })

  it('does not expose the active source project tree to a background-source tile', () => {
    recordSessionEventScope({ connectionId: 'homelab', profile: 'remote-lead', session_id: 'runtime-1' })
    $sessions.set([])
    $currentCwd.set('C:\\Repos\\App\\src')
    $projectTree.set([
      {
        id: 'project-local',
        label: 'App',
        path: 'C:\\Repos\\App',
        repos: [],
        sessionCount: 1
      }
    ])
    $projectTreeOwner.set({ connectionId: 'local', profile: 'default', scope: 'profile' })

    const props = {
      gateway: null,
      maxVoiceRecordingSeconds: 120,
      onAddContextRef: vi.fn(),
      onAddUrl: vi.fn(),
      onAttachDroppedItems: vi.fn(),
      onAttachImageBlob: vi.fn(),
      onBranchInNewChat: vi.fn(),
      onCancel: vi.fn(),
      onDeleteSelectedSession: vi.fn(),
      onEdit: vi.fn(),
      onPasteClipboardImage: vi.fn(),
      onPickFiles: vi.fn(),
      onPickFolders: vi.fn(),
      onPickImages: vi.fn(),
      onReload: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onRetryResume: vi.fn(),
      onSteer: vi.fn(),
      onSubmit: vi.fn(),
      onThreadMessagesChange: vi.fn(),
      onToggleSelectedPin: vi.fn(),
      onTranscribeAudio: vi.fn()
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/stored-1']}>
          <ChatView {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(advisorRender.current?.leadConnectionId).toBe('homelab')
    expect(advisorRender.current?.leadProfile).toBe('remote-lead')
    expect(advisorRender.current?.projectKey).toBe('')
  })

  it('does not expose the aggregate all-profiles project tree as an exact project owner', () => {
    $currentCwd.set('C:\\Repos\\App\\src')
    $showAllProfiles.set(true)
    $projectTree.set([
      {
        id: 'project-from-aggregate',
        label: 'App',
        path: 'C:\\Repos\\App',
        repos: [],
        sessionCount: 2
      }
    ])
    $projectTreeOwner.set({ scope: 'all-profiles' })

    const props = {
      gateway: null,
      maxVoiceRecordingSeconds: 120,
      onAddContextRef: vi.fn(),
      onAddUrl: vi.fn(),
      onAttachDroppedItems: vi.fn(),
      onAttachImageBlob: vi.fn(),
      onBranchInNewChat: vi.fn(),
      onCancel: vi.fn(),
      onDeleteSelectedSession: vi.fn(),
      onEdit: vi.fn(),
      onPasteClipboardImage: vi.fn(),
      onPickFiles: vi.fn(),
      onPickFolders: vi.fn(),
      onPickImages: vi.fn(),
      onReload: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onRetryResume: vi.fn(),
      onSteer: vi.fn(),
      onSubmit: vi.fn(),
      onThreadMessagesChange: vi.fn(),
      onToggleSelectedPin: vi.fn(),
      onTranscribeAudio: vi.fn()
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/stored-1']}>
          <ChatView {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(advisorRender.current?.projectKey).toBe('')
  })

  it('keeps a primary local runtime bound to the local source', () => {
    recordPrimarySessionEventSource({ session_id: 'runtime-1' }, { mode: 'local' } as never)

    const props = {
      gateway: null,
      maxVoiceRecordingSeconds: 120,
      onAddContextRef: vi.fn(),
      onAddUrl: vi.fn(),
      onAttachDroppedItems: vi.fn(),
      onAttachImageBlob: vi.fn(),
      onBranchInNewChat: vi.fn(),
      onCancel: vi.fn(),
      onDeleteSelectedSession: vi.fn(),
      onEdit: vi.fn(),
      onPasteClipboardImage: vi.fn(),
      onPickFiles: vi.fn(),
      onPickFolders: vi.fn(),
      onPickImages: vi.fn(),
      onReload: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onRetryResume: vi.fn(),
      onSteer: vi.fn(),
      onSubmit: vi.fn(),
      onThreadMessagesChange: vi.fn(),
      onToggleSelectedPin: vi.fn(),
      onTranscribeAudio: vi.fn()
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/stored-1']}>
          <ChatView {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(advisorRender.current?.leadConnectionId).toBe('local')
    expect(advisorRender.current?.gatewayConnectionId).toBe('local')
  })

  it('keeps draft Agents unresolved while binding Gateway to the active source', () => {
    clearAllSessionStates()
    $activeSessionId.set(null)
    $selectedStoredSessionId.set(null)
    $sessions.set([])
    $connection.set({ connectionId: 'registry-b', mode: 'remote' } as never)

    const props = {
      gateway: null,
      maxVoiceRecordingSeconds: 120,
      onAddContextRef: vi.fn(),
      onAddUrl: vi.fn(),
      onAttachDroppedItems: vi.fn(),
      onAttachImageBlob: vi.fn(),
      onBranchInNewChat: vi.fn(),
      onCancel: vi.fn(),
      onDeleteSelectedSession: vi.fn(),
      onEdit: vi.fn(),
      onPasteClipboardImage: vi.fn(),
      onPickFiles: vi.fn(),
      onPickFolders: vi.fn(),
      onPickImages: vi.fn(),
      onReload: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onRetryResume: vi.fn(),
      onSteer: vi.fn(),
      onSubmit: vi.fn(),
      onThreadMessagesChange: vi.fn(),
      onToggleSelectedPin: vi.fn(),
      onTranscribeAudio: vi.fn()
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <ChatView {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(advisorRender.current?.leadConnectionId).toBeNull()
    expect(advisorRender.current?.gatewayConnectionId).toBe('registry-b')
  })
})
