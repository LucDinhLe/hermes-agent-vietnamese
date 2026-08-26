import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SearchField } from '@/components/ui/search-field'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { compactNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  $dismissedAutoProjectIds,
  $pinnedProjectIds,
  dismissAutoProject,
  filterVisibleProjects,
  pinProject,
  unpinProject
} from '@/store/layout'
import {
  $activeProjectId,
  $projectTree,
  $projectTreeLoading,
  archiveProject,
  deleteProject,
  goToProject,
  openProjectCreate,
  refreshProjects,
  refreshProjectTree
} from '@/store/projects'

import { useRefreshHotkey } from '../hooks/use-refresh-hotkey'
import { NEW_CHAT_ROUTE } from '../routes'

export function ProjectsView() {
  const { t } = useI18n()
  const p = t.sidebar.projects
  const row = t.sidebar.row
  const navigate = useNavigate()
  const projectTree = useStore($projectTree)
  const loading = useStore($projectTreeLoading)
  const activeProjectId = useStore($activeProjectId)
  const pinnedProjectIds = useStore($pinnedProjectIds)
  const dismissedAutoProjectIds = useStore($dismissedAutoProjectIds)
  const [query, setQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<null | SidebarProjectTree>(null)

  const refresh = useCallback(async () => {
    await Promise.all([refreshProjects(), refreshProjectTree()])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRefreshHotkey(refresh)

  const projects = useMemo(() => {
    const visible = filterVisibleProjects(projectTree, dismissedAutoProjectIds).filter(project => !project.isNoProject)
    const needle = query.trim().toLocaleLowerCase()
    const pinned = new Set(pinnedProjectIds)

    return visible
      .filter(project => !needle || `${project.label} ${project.path ?? ''}`.toLocaleLowerCase().includes(needle))
      .sort((left, right) => {
        const pinOrder = Number(pinned.has(right.id)) - Number(pinned.has(left.id))

        return pinOrder || left.label.localeCompare(right.label)
      })
  }, [dismissedAutoProjectIds, pinnedProjectIds, projectTree, query])

  const openProject = (id: string) => {
    goToProject(id)
    navigate(NEW_CHAT_ROUTE)
  }

  const hideProject = async (project: SidebarProjectTree) => {
    if (project.isAuto) {
      dismissAutoProject(project.id)
    } else {
      await archiveProject(project.id)
    }

    if (pinnedProjectIds.includes(project.id)) {
      unpinProject(project.id)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return
    }

    const id = deleteTarget.id
    await deleteProject(id)
    unpinProject(id)
  }

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden bg-(--ui-chat-surface-background)">
      <header className="flex shrink-0 items-end justify-between gap-4 px-5 pb-4 pt-[calc(var(--titlebar-height)+1rem)]">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{p.sectionLabel}</h1>
          <p className="mt-1 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
            {p.manageDescription}
          </p>
        </div>
        <Button className="shrink-0" onClick={openProjectCreate} size="sm">
          <Codicon name="add" size="0.75rem" />
          {p.newButton}
        </Button>
      </header>

      {projectTree.length > 0 && (
        <div className="shrink-0 px-5 pb-3">
          <SearchField
            containerClassName="max-w-xl"
            onChange={setQuery}
            placeholder={p.searchPlaceholder}
            value={query}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 [scrollbar-gutter:stable]">
        {!loading && projects.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div className="max-w-sm">
              <Codicon className="mx-auto text-(--ui-text-quaternary)" name="root-folder" size="1.75rem" />
              <h2 className="mt-3 text-sm font-medium text-foreground">{p.emptyTitle}</h2>
              <p className="mt-1 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
                {p.emptyDescription}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map(project => {
              const pinned = pinnedProjectIds.includes(project.id)
              const active = activeProjectId === project.id

              return (
                <article
                  className={cn(
                    'group flex min-w-0 flex-col rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) p-4 transition-colors hover:border-(--ui-stroke-secondary)',
                    active && 'border-[color:var(--dt-primary)]/45'
                  )}
                  key={project.id}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--ui-control-hover-background) text-(--ui-text-secondary)"
                      style={project.color ? { color: project.color } : undefined}
                    >
                      <Codicon name={project.icon || 'root-folder'} size="1rem" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-foreground">{project.label}</h2>
                        {active && <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--dt-primary)]" />}
                        {project.isAuto && (
                          <span className="shrink-0 text-[0.625rem] font-medium text-(--ui-text-tertiary)">
                            {p.autoDiscovered}
                          </span>
                        )}
                      </div>
                      {project.path && (
                        <p
                          className="mt-0.5 truncate font-mono text-[0.65rem] text-(--ui-text-quaternary)"
                          title={project.path}
                        >
                          {project.path}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Tip label={pinned ? row.unpin : row.pin}>
                        <Button
                          aria-label={pinned ? row.unpin : row.pin}
                          className={cn('text-(--ui-text-tertiary)', pinned && 'text-[color:var(--dt-primary)]')}
                          onClick={() => (pinned ? unpinProject(project.id) : pinProject(project.id))}
                          size="icon-xs"
                          variant="ghost"
                        >
                          <Codicon name={pinned ? 'pinned' : 'pin'} size="0.8rem" />
                        </Button>
                      </Tip>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-(--ui-text-tertiary)">
                    <span>{p.sessionsCount(project.sessionCount)}</span>
                    <span>{p.tokensCount(compactNumber(project.totalTokens ?? 0))}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <Button onClick={() => openProject(project.id)} size="xs" variant="outline">
                      {p.open}
                      <Codicon name="arrow-right" size="0.7rem" />
                    </Button>
                    <Button onClick={() => void hideProject(project)} size="xs" variant="ghost">
                      <Codicon name="eye-closed" size="0.7rem" />
                      {p.removeFromSidebar}
                    </Button>
                    {!project.isAuto && (
                      <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(project)}
                        size="xs"
                        variant="ghost"
                      >
                        <Codicon name="trash" size="0.7rem" />
                        {p.menuDelete}
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
      <ConfirmDialog
        confirmLabel={p.menuDelete}
        description={p.deleteConfirm}
        destructive
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `${p.menuDelete} "${deleteTarget.label}"?` : p.menuDelete}
      />
    </section>
  )
}
