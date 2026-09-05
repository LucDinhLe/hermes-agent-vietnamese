import { useRef, useState } from 'react'

import { ArchiveSkillConfirmDialog, fireOptimistic } from '@/app/learning/archive-skill-confirm-dialog'
import { CodeEditor } from '@/components/chat/code-editor'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteLearningNode, editLearningNode, getLearningNode } from '@/hermes'
import { useI18n } from '@/i18n'
import { activeBackendOwner, type BackendOwner, sameBackendOwner } from '@/store/backend-owner'
import { notifyError } from '@/store/notifications'
import { evictStarmapNode, loadStarmapGraph } from '@/store/starmap'

import { useOnProfileSwitch } from '../hooks/use-on-profile-switch'

export interface NodeMenuTarget {
  id: string
  kind: 'memory' | 'skill'
  label: string
  x: number
  y: number
}

interface NodeContextMenuProps {
  onClose: () => void
  onNodeRemoved: () => void
  target: NodeMenuTarget | null
}

interface EditState {
  content: string
  id: string
  label: string
  owner: BackendOwner
}

type DeleteState = Omit<NodeMenuTarget, 'x' | 'y'> & { owner: BackendOwner }

/** Right-click actions for a star-map node: edit (modal) or delete (confirm). */
export function NodeContextMenu({ onClose, onNodeRemoved, target }: NodeContextMenuProps) {
  const { locale, t } = useI18n()
  const isVi = locale === 'vi'
  const [editing, setEditing] = useState<EditState | null>(null)
  const [deleting, setDeleting] = useState<DeleteState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)

  // Bumped on profile switch so an in-flight openEdit fetch from profile A can't
  // reopen the editor with A's node content after switching to B.
  const editEpoch = useRef(0)

  // A profile switch swaps the backend under an open edit/delete dialog — its
  // node id belongs to the previous profile, so a Save/Delete after the switch
  // would hit the newly active profile. Close everything on switch.
  useOnProfileSwitch(() => {
    editEpoch.current += 1
    setEditing(null)
    setDeleting(null)
    setError(null)
  })

  const nounKind = target?.kind === 'memory' ? 'memory' : 'skill'
  const noun = nounKind === 'memory' ? (isVi ? 'bộ nhớ' : 'memory') : isVi ? 'kỹ năng' : 'skill'

  const openEdit = async () => {
    if (!target) {
      return
    }

    const owner = activeBackendOwner()

    if (!owner) {
      return
    }

    const epoch = editEpoch.current
    setLoading(true)
    setError(null)

    try {
      const detail = await getLearningNode(target.id, owner.profile, owner.connectionId)

      if (editEpoch.current !== epoch || !sameBackendOwner(activeBackendOwner(), owner)) {
        return
      }

      setEditing({ content: detail.content, id: target.id, label: target.label, owner })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!editing) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await editLearningNode(editing.id, editing.content, editing.owner.profile, editing.owner.connectionId)

      if (!res.ok) {
        throw new Error(res.message)
      }

      setEditing(null)

      if (sameBackendOwner(activeBackendOwner(), editing.owner)) {
        void loadStarmapGraph(true, editing.owner)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const menuOpen = target && !editing && !deleting

  return (
    <>
      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={e => e.preventDefault()} />
          {/* Styled to DropdownMenuContent/Item scale (rounded-lg card, p-1,
              text-xs rows) — the hand-rolled fixed positioning stays because
              the target is a canvas point, not a DOM anchor. */}
          <div
            className="fixed z-50 min-w-36 rounded-lg border border-(--ui-stroke-secondary) bg-[color-mix(in_srgb,var(--ui-bg-elevated)_96%,transparent)] p-1 shadow-md backdrop-blur-md"
            style={{ left: target.x, top: target.y }}
          >
            <div className="truncate px-2 py-1 text-[0.68rem] text-muted-foreground">{target.label}</div>
            <button
              className="block w-full cursor-pointer rounded-md px-2 py-1 text-left text-xs hover:bg-(--ui-control-active-background) hover:text-foreground disabled:opacity-50"
              disabled={loading}
              onClick={() => void openEdit()}
              type="button"
            >
              {isVi ? 'Chỉnh sửa' : 'Edit'} {noun}…
            </button>
            <button
              className="block w-full cursor-pointer rounded-md px-2 py-1 text-left text-xs text-destructive hover:bg-destructive/10"
              onClick={() => {
                const owner = activeBackendOwner()

                if (!owner) {
                  return
                }

                setDeleting({ id: target.id, kind: target.kind, label: target.label, owner })
                onClose()
              }}
              type="button"
            >
              {target.kind === 'skill'
                ? isVi
                  ? 'Lưu trữ kỹ năng'
                  : 'Archive skill'
                : isVi
                  ? 'Xóa bộ nhớ'
                  : 'Delete memory'}
            </button>
          </div>
        </>
      ) : null}

      <Dialog onOpenChange={value => !value && !saving && setEditing(null)} open={Boolean(editing)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isVi ? 'Chỉnh sửa' : 'Edit'} {editing?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="h-80">
            {editing && (
              <CodeEditor
                filePath={nounKind === 'skill' ? 'SKILL.md' : 'memory.md'}
                framed
                initialValue={editing.content}
                key={editing.id}
                onCancel={() => !saving && setEditing(null)}
                onChange={content => setEditing(prev => (prev ? { ...prev, content } : prev))}
                onSave={() => void save()}
              />
            )}
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button disabled={saving} onClick={() => setEditing(null)} type="button" variant="ghost">
              {t.common.cancel}
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleting?.kind === 'skill' ? (
        <ArchiveSkillConfirmDialog
          connectionId={deleting.owner.connectionId}
          onApply={() => {
            onNodeRemoved()

            return evictStarmapNode(deleting.id, deleting.owner)
          }}
          onClose={() => setDeleting(null)}
          onFailure={(err, name) => notifyError(err, name)}
          open
          profile={deleting.owner.profile}
          skillId={deleting.id}
          skillName={deleting.label}
        />
      ) : (
        <ConfirmDialog
          confirmLabel={t.common.delete}
          description={isVi ? 'Bộ nhớ này sẽ bị xóa vĩnh viễn.' : 'This memory is removed permanently.'}
          destructive
          dismissOnConfirm
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            if (!deleting) {
              return
            }

            const { id, label, owner } = deleting
            const rollback = evictStarmapNode(id, owner)
            onNodeRemoved()

            fireOptimistic(
              deleteLearningNode(id, owner.profile, owner.connectionId).then(res => {
                if (!res.ok) {
                  throw new Error(res.message)
                }
              }),
              rollback,
              err => notifyError(err, label)
            )
          }}
          open={Boolean(deleting)}
          title={isVi ? `Xóa ${deleting?.label ?? ''}?` : `Delete ${deleting?.label ?? ''}?`}
        />
      )}
    </>
  )
}
