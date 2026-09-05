import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { applyWorkProfile, getSkills, getWorkProfile, recommendWorkProfile, type SkillInfo } from '@/hermes'
import { useI18n } from '@/i18n'
import { Brain, Layers3 } from '@/lib/icons'
import type { BackendOwner } from '@/store/backend-owner'

import { ListRow, SettingsContent, SettingsSection, SettingsSkeleton } from './primitives'

const WORK_AREAS = [
  'research_learning',
  'leadership_business',
  'writing_content',
  'software_building',
  'office_productivity',
  'creative_media'
] as const

const splitTasks = (value: string) =>
  value
    .split('\n')
    .map(task => task.trim())
    .filter(Boolean)
    .slice(0, 3)

export function WorkProfileSettings({ backendOwner }: { backendOwner: BackendOwner | null }) {
  const { t } = useI18n()
  const copy = t.settings.workProfile
  const [areas, setAreas] = useState<Set<string>>(new Set())
  const [commonTasks, setCommonTasks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const profile = backendOwner?.profile
  const connectionId = backendOwner?.connectionId

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    void Promise.all([getWorkProfile(profile, connectionId), getSkills(profile, connectionId)])
      .then(([state, installed]) => {
        if (!active) {
          return
        }
        setAreas(new Set(state.work_areas))
        setCommonTasks(state.common_tasks.join('\n'))
        setSkills(installed)
        // Legacy profiles keep their current behavior until the user explicitly saves.
        setSelected(new Set(state.allowed ?? installed.filter(skill => skill.enabled).map(skill => skill.name)))
      })
      .catch(() => active && setError(copy.loadFailed))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [connectionId, copy.loadFailed, profile])

  const orderedSelected = useMemo(
    () => skills.map(skill => skill.name).filter(name => selected.has(name)),
    [selected, skills]
  )

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set)

    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }

    return next
  }

  const preview = async () => {
    setPreviewing(true)
    setSaved(false)
    setError(null)

    try {
      const recommendation = await recommendWorkProfile(
        { common_tasks: splitTasks(commonTasks), work_areas: [...areas] },
        profile,
        connectionId
      )

      setSelected(new Set(recommendation.skills))
    } catch {
      setError(copy.previewFailed)
    } finally {
      setPreviewing(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      await applyWorkProfile(
        {
          allowed_skills: orderedSelected,
          common_tasks: splitTasks(commonTasks),
          skipped: false,
          work_areas: [...areas]
        },
        profile,
        connectionId
      )
      setSaved(true)
    } catch {
      setError(copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SettingsSkeleton sections={[{ heading: true, rows: 3 }]} />
  }

  return (
    <SettingsContent>
      <SettingsSection icon={Brain} title={copy.title}>
        <p className="mb-4 text-sm text-muted-foreground">{copy.intro}</p>
        <div className="grid gap-2">
          {WORK_AREAS.map(area => (
            <label className="flex items-center gap-2 py-1 text-sm" key={area}>
              <Checkbox checked={areas.has(area)} onCheckedChange={() => setAreas(current => toggle(current, area))} />
              {copy.areas[area]}
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium" htmlFor="work-profile-tasks">
          {copy.commonTasks}
        </label>
        <p className="mb-2 text-sm text-muted-foreground">{copy.commonTasksHint}</p>
        <Textarea
          id="work-profile-tasks"
          onChange={event => setCommonTasks(event.target.value)}
          placeholder={copy.commonTasksPlaceholder}
          value={commonTasks}
        />
        <Button className="mt-3" disabled={previewing} onClick={() => void preview()} type="button" variant="outline">
          {previewing ? copy.previewing : copy.preview}
        </Button>
      </SettingsSection>

      <SettingsSection icon={Layers3} meta={`${orderedSelected.length}/${skills.length}`} title={copy.skillsTitle}>
        <p className="mb-2 text-sm text-muted-foreground">{copy.skillsHint}</p>
        <div className="divide-y divide-border">
          {skills.map(skill => (
            <ListRow
              action={
                <Checkbox
                  aria-label={copy.toggleSkill(skill.name)}
                  checked={selected.has(skill.name)}
                  onCheckedChange={() => setSelected(current => toggle(current, skill.name))}
                />
              }
              description={skill.description}
              key={skill.name}
              title={skill.name}
            />
          ))}
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {copy.saved}
          </p>
        )}
        <Button className="mt-3" disabled={saving} onClick={() => void save()} type="button">
          {saving ? copy.saving : copy.save}
        </Button>
      </SettingsSection>
    </SettingsContent>
  )
}
