export type MockCompletionKind = 'agent' | 'title_generation' | 'auxiliary'

export interface MockCompletionRequest {
  kind: MockCompletionKind
  userText: string
}

export function classifyMockCompletionRequest(value: unknown): MockCompletionRequest
