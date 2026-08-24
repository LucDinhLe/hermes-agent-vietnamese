import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteLearningNode } from '@/hermes'
import { type Translations, useI18n } from '@/i18n'
import { notify } from '@/store/notifications'

export function notifySkillArchived(t: Translations): void {
  notify({ kind: 'success', message: t.skills.skillArchivedMessage, title: t.skills.skillArchivedTitle })
}

export async function archiveLearningSkill(
  id: string,
  profile?: null | string,
  connectionId?: null | string,
  failureMessage = ''
): Promise<void> {
  const res = await deleteLearningNode(id, profile, connectionId)

  if (!res.ok) {
    throw new Error(res.message || failureMessage)
  }
}

/** Fire-and-forget a mutation whose UI already applied optimistically; a failure just rolls it back + reports. */
export function fireOptimistic(action: Promise<void>, rollback: () => void, onFailure: (err: unknown) => void): void {
  void action.catch(err => {
    rollback()
    onFailure(err)
  })
}

interface ArchiveSkillConfirmDialogProps {
  /** Immutable backend source paired with `profile`. */
  connectionId?: null | string
  /** Apply optimistic UI updates; return rollback if the background archive fails. */
  onApply: () => () => void
  onClose: () => void
  onFailure?: (err: unknown, skillName: string) => void
  onSuccess?: () => void
  open: boolean
  /** Capabilities profile-scope override — archive against THIS profile's
   *  backend; undefined/null keeps the app-wide active profile. */
  profile?: null | string
  skillId: string
  skillName: string
}

/** Shared archive confirm for learned skills (capabilities page + memory graph). */
export function ArchiveSkillConfirmDialog({
  connectionId,
  onApply,
  onClose,
  onFailure,
  onSuccess,
  open,
  profile,
  skillId,
  skillName
}: ArchiveSkillConfirmDialogProps) {
  const { t } = useI18n()

  return (
    <ConfirmDialog
      confirmLabel={t.skills.archive}
      description={t.skills.archiveDescription}
      destructive
      dismissOnConfirm
      onClose={onClose}
      onConfirm={() => {
        const rollback = onApply()

        fireOptimistic(
          archiveLearningSkill(skillId, profile, connectionId, t.skills.archiveFailed).then(() => {
            notifySkillArchived(t)
            onSuccess?.()
          }),
          rollback,
          err => onFailure?.(err, skillName)
        )
      }}
      open={open}
      title={t.skills.archiveConfirmTitle(skillName)}
    />
  )
}
