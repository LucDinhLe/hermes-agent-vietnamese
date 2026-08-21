import type { ReactNode } from 'react'

import { ContribBoundary, ContribRender } from '@/contrib/react/boundary'
import { useContributions } from '@/contrib/react/use-contributions'

export const SESSION_AGENTS_AREA = 'chat.sessionAgents'

export interface SessionAgentsSurfaceProps {
  /** Live gateway id. Null while a new chat is still a draft. */
  runtimeSessionId: string | null
  /** Durable lineage id used for collaboration membership persistence. */
  storedSessionId: string | null
  /** Profile that owns the conversation. Adding a collaborator must not change it. */
  leadProfile: string
  /** Registry source that owns this tile/session (`local` is explicit); null means unresolved/draft. */
  leadConnectionId: string | null
  /** Stable project id from projects.tree; empty when the exact session is not in a project. */
  projectKey: string
  /** True when projectKey was resolved from the exact source/profile tree, including a known empty result. */
  projectResolutionKnown: boolean
  busy: boolean
}

export interface SessionAgentsContribution {
  render: (props: SessionAgentsSurfaceProps) => ReactNode
}

/**
 * Per-chat extension point for the Agents control.
 *
 * The host owns placement so context/cost, Agents, and Advisor always share the
 * same chat-pane clipping boundary. Plugins own roster and membership behavior;
 * the props keep every split/tile scoped to its own durable conversation.
 */
export function SessionAgentsSlot(props: SessionAgentsSurfaceProps) {
  const contributions = useContributions(SESSION_AGENTS_AREA)

  return contributions.map(contribution => {
    const surface = contribution.data as SessionAgentsContribution | undefined

    if (typeof surface?.render !== 'function') {
      return null
    }

    return (
      <div className="min-w-0 shrink-0" data-session-agents-slot="" key={`${contribution.source}:${contribution.id}`}>
        <ContribBoundary id={`${contribution.source}:${contribution.id}`} variant="chip">
          <ContribRender props={props} render={surface.render} />
        </ContribBoundary>
      </div>
    )
  })
}
