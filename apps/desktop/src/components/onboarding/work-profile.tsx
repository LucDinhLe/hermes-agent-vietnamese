import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { applyWorkProfile, getSkills, getWorkProfile, recommendWorkProfile, type SkillInfo } from '@/hermes'
import { useI18n } from '@/i18n'
import { Loader2, Plus, X } from '@/lib/icons'
import { cn } from '@/lib/utils'

const WORK_AREAS = [
  'research_learning',
  'leadership_business',
  'writing_content',
  'software_building',
  'office_productivity',
  'creative_media'
] as const

export interface WorkProfileSetupProps {
  connectionId?: null | string
  firstRun?: boolean
  onDone?: (skipped: boolean) => void
  profile?: null | string
}

function taskLines(value: string): string[] {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 3)
}

export function WorkProfileSetup({ connectionId, firstRun = false, onDone, profile }: WorkProfileSetupProps) {
  const { t } = useI18n()
  const copy = t.onboarding.workProfile
  const [areas, setAreas] = useState<string[]>([])
  const [tasks, setTasks] = useState('')
  const [installed, setInstalled] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [previewed, setPreviewed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false

    void Promise.all([getWorkProfile(profile, connectionId), getSkills(profile, connectionId)])
      .then(([state, skills]) => {
        if (cancelled) {
          return
        }

        if (firstRun && (state.completed || state.onboarding_required !== true)) {
          setDismissed(true)
          onDone?.(state.skipped)

          return
        }

        setAreas(state.work_areas)
        setTasks(state.common_tasks.join('\n'))
        setSelected(state.allowed ?? [])
        setInstalled(skills)
        setPreviewed(state.completed && !state.skipped)
      })
      .catch(() => {
        if (!cancelled) {
          setError(copy.failed)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [connectionId, copy.failed, firstRun, onDone, profile])

  const available = useMemo(
    () => installed.filter(skill => !selected.includes(skill.name)).sort((a, b) => a.name.localeCompare(b.name)),
    [installed, selected]
  )

  const toggleArea = (area: string) => {
    setAreas(current => (current.includes(area) ? current.filter(item => item !== area) : [...current, area]))
  }

  const preview = async () => {
    const commonTasks = taskLines(tasks)

    if (areas.length === 0 && commonTasks.length === 0) {
      setError(copy.empty)

      return
    }

    setBusy(true)
    setError(null)

    try {
      const result = await recommendWorkProfile({ common_tasks: commonTasks, work_areas: areas }, profile, connectionId)
      setSelected(result.skills)
      setPreviewed(true)
    } catch {
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const persist = async (skipped: boolean) => {
    setBusy(true)
    setError(null)

    try {
      await applyWorkProfile(
        {
          allowed_skills: skipped ? [] : selected,
          common_tasks: skipped ? [] : taskLines(tasks),
          skipped,
          work_areas: skipped ? [] : areas
        },
        profile,
        connectionId ?? undefined
      )
      onDone?.(skipped)
    } catch {
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  if (dismissed) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground" role="status">
        <Loader2 className="animate-spin" /> {copy.loading}
      </div>
    )
  }

  return (
    <section aria-labelledby="work-profile-title" className="grid gap-5 p-5">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold" id="work-profile-title">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{copy.areasLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {WORK_AREAS.map(area => (
            <Button
              aria-pressed={areas.includes(area)}
              key={area}
              onClick={() => toggleArea(area)}
              type="button"
              variant={areas.includes(area) ? 'secondary' : 'outline'}
            >
              {copy.areas[area]}
            </Button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-medium">
        {copy.tasksLabel}
        <Textarea
          aria-label={copy.tasksLabel}
          onChange={event => setTasks(event.target.value)}
          placeholder={copy.tasksPlaceholder}
          rows={3}
          value={tasks}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} onClick={() => void preview()} type="button" variant="secondary">
          {busy ? <Loader2 className="animate-spin" /> : null}
          {copy.preview}
        </Button>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {previewed ? (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">{copy.previewTitle}</h3>
            <div className="flex flex-wrap gap-2">
              {selected.map(skill => (
                <Button
                  aria-label={copy.remove(skill)}
                  key={skill}
                  onClick={() => setSelected(current => current.filter(item => item !== skill))}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {skill}
                  <X />
                </Button>
              ))}
            </div>
          </div>
          {available.length > 0 ? (
            <details className="grid gap-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">{copy.availableTitle}</summary>
              <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-auto">
                {available.map(skill => (
                  <Button
                    aria-label={copy.add(skill.name)}
                    key={skill.name}
                    onClick={() => setSelected(current => [...current, skill.name])}
                    size="sm"
                    title={skill.description}
                    type="button"
                    variant="outline"
                  >
                    <Plus />
                    {skill.name}
                  </Button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className={cn('flex items-center gap-3', firstRun ? 'justify-between' : 'justify-end')}>
        {firstRun ? (
          <Button disabled={busy} onClick={() => void persist(true)} type="button" variant="text">
            {copy.skip}
          </Button>
        ) : null}
        <div className="flex items-center gap-2">
          {previewed ? (
            <Button disabled={busy} onClick={() => setPreviewed(false)} type="button" variant="outline">
              {t.common.back}
            </Button>
          ) : null}
          <Button
            disabled={busy || !previewed || selected.length === 0}
            onClick={() => void persist(false)}
            type="button"
          >
            {busy ? copy.saving : copy.save}
          </Button>
        </div>
      </div>
    </section>
  )
}
