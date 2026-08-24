import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  activateCustomEndpoint,
  deleteCustomEndpoint,
  getCustomEndpoints,
  saveCustomEndpoint,
  validateCustomEndpoint
} from '@/hermes'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Check, Globe, Loader2, Plus, Save, Trash2, Zap } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { BackendOwner } from '@/store/backend-owner'
import { notify, notifyError } from '@/store/notifications'
import type { CustomEndpoint, CustomEndpointUpdate } from '@/types/hermes'

import { useBackendOwnerGuard } from '../hooks/use-backend-owner-guard'

import { EmptyState, Pill, SectionHeading, SettingsContent, SettingsSkeleton } from './primitives'

interface CustomEndpointsSettingsProps {
  backendOwner?: BackendOwner | null
  onConfigSaved?: () => void
  onMainModelChanged?: (provider: string, model: string) => void
}

interface EndpointForm {
  apiKey: string
  baseUrl: string
  contextLength: string
  discoverModels: boolean
  id: string
  makeDefault: boolean
  model: string
  name: string
}

const EMPTY_FORM: EndpointForm = {
  apiKey: '',
  baseUrl: '',
  contextLength: '',
  discoverModels: true,
  id: '',
  makeDefault: true,
  model: '',
  name: ''
}

function formFromEndpoint(endpoint: CustomEndpoint): EndpointForm {
  return {
    apiKey: '',
    baseUrl: endpoint.base_url,
    contextLength: endpoint.context_length ? String(endpoint.context_length) : '',
    discoverModels: endpoint.discover_models,
    id: endpoint.id,
    makeDefault: Boolean(endpoint.is_current),
    model: endpoint.model,
    name: endpoint.name
  }
}

function toPayload(form: EndpointForm, models?: string[]): CustomEndpointUpdate {
  const contextLength = Number.parseInt(form.contextLength, 10)

  return {
    id: form.id.trim() || undefined,
    name: form.name.trim(),
    base_url: form.baseUrl.trim(),
    model: form.model.trim(),
    api_key: form.apiKey.trim() || undefined,
    context_length: Number.isFinite(contextLength) && contextLength > 0 ? contextLength : undefined,
    discover_models: form.discoverModels,
    make_default: form.makeDefault,
    models: models?.length ? models : undefined
  }
}

export function CustomEndpointsSettings({
  backendOwner = null,
  onConfigSaved,
  onMainModelChanged
}: CustomEndpointsSettingsProps) {
  const { locale, t } = useI18n()
  const isVi = locale === 'vi'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [endpoints, setEndpoints] = useState<CustomEndpoint[]>([])
  const [form, setForm] = useState<EndpointForm>(EMPTY_FORM)
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([])
  const isCurrentOwner = useBackendOwnerGuard(backendOwner)

  async function refresh() {
    const data = await getCustomEndpoints(backendOwner?.profile, backendOwner?.connectionId)

    if (isCurrentOwner()) {
      setEndpoints(data.endpoints)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await getCustomEndpoints(backendOwner?.profile, backendOwner?.connectionId)

        if (cancelled || !isCurrentOwner()) {
          return
        }

        setEndpoints(data.endpoints)
        const current = data.endpoints.find(endpoint => endpoint.is_current) ?? data.endpoints[0]

        if (current) {
          setForm(formFromEndpoint(current))
          setDiscoveredModels(current.models)
        }
      } catch (err) {
        if (!cancelled && isCurrentOwner()) {
          notifyError(err, isVi ? 'Không thể tải máy chủ tùy chỉnh' : 'Could not load custom endpoints')
        }
      } finally {
        if (!cancelled && isCurrentOwner()) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [backendOwner?.connectionId, backendOwner?.profile, isCurrentOwner, isVi])

  async function handleSave() {
    try {
      setSaving(true)

      const response = await saveCustomEndpoint(
        toPayload(form, discoveredModels),
        backendOwner?.profile,
        backendOwner?.connectionId
      )

      if (!isCurrentOwner()) {
        return
      }

      setEndpoints(response.endpoints)
      const saved = response.endpoints.find(endpoint => endpoint.id === response.id)

      if (saved) {
        setForm(formFromEndpoint(saved))
        setDiscoveredModels(saved.models)
      }

      if (saved && saved.is_current) {
        onMainModelChanged?.(saved.id, saved.model)
      }

      triggerHaptic('success')
      onConfigSaved?.()
      notify({ kind: 'success', message: isVi ? 'Đã lưu máy chủ tùy chỉnh.' : 'Custom endpoint saved.' })
    } catch (err) {
      if (isCurrentOwner()) {
        notifyError(err, isVi ? 'Lưu thất bại' : 'Save failed')
      }
    } finally {
      if (isCurrentOwner()) {
        setSaving(false)
      }
    }
  }

  async function handleValidate() {
    try {
      setTesting(true)
      const response = await validateCustomEndpoint(toPayload(form), backendOwner?.profile, backendOwner?.connectionId)

      if (!isCurrentOwner()) {
        return
      }

      setDiscoveredModels(response.models)

      if (response.ok) {
        if (!form.model && response.models[0]) {
          setForm(current => ({ ...current, model: response.models[0] }))
        }

        notify({
          kind: 'success',
          message: response.models.length
            ? isVi
              ? `Đã kết nối. Tìm thấy ${response.models.length} model.`
              : `Endpoint is reachable. Found ${response.models.length} models.`
            : isVi
              ? 'Đã kết nối tới máy chủ.'
              : 'Endpoint is reachable.'
        })
      } else {
        notify({
          kind: response.reachable ? 'warning' : 'error',
          message: response.message || (isVi ? 'Kiểm tra máy chủ thất bại.' : 'Endpoint validation failed.')
        })
      }
    } catch (err) {
      if (isCurrentOwner()) {
        notifyError(err, isVi ? 'Kiểm tra thất bại' : 'Validation failed')
      }
    } finally {
      if (isCurrentOwner()) {
        setTesting(false)
      }
    }
  }

  async function handleActivate(endpoint: CustomEndpoint) {
    try {
      setActivating(endpoint.id)
      const response = await activateCustomEndpoint(endpoint.id, backendOwner?.profile, backendOwner?.connectionId)

      if (!isCurrentOwner()) {
        return
      }

      await refresh()

      if (!isCurrentOwner()) {
        return
      }

      onConfigSaved?.()
      onMainModelChanged?.(response.provider, response.model)
      triggerHaptic('success')
    } catch (err) {
      if (isCurrentOwner()) {
        notifyError(err, isVi ? 'Kích hoạt thất bại' : 'Activation failed')
      }
    } finally {
      if (isCurrentOwner()) {
        setActivating(null)
      }
    }
  }

  async function handleDelete(endpoint: CustomEndpoint) {
    if (!window.confirm(isVi ? `Xóa ${endpoint.name}?` : `Delete ${endpoint.name}?`)) {
      return
    }

    try {
      setDeleting(endpoint.id)
      const response = await deleteCustomEndpoint(endpoint.id, backendOwner?.profile, backendOwner?.connectionId)

      if (!isCurrentOwner()) {
        return
      }

      setEndpoints(response.endpoints)

      if (form.id === endpoint.id) {
        setForm(EMPTY_FORM)
        setDiscoveredModels([])
      }

      onConfigSaved?.()
      triggerHaptic('success')
    } catch (err) {
      if (isCurrentOwner()) {
        notifyError(err, isVi ? 'Xóa thất bại' : 'Delete failed')
      }
    } finally {
      if (isCurrentOwner()) {
        setDeleting(null)
      }
    }
  }

  if (loading) {
    return <SettingsSkeleton sections={[{ heading: true, rows: 3 }]} />
  }

  const allModelOptions = Array.from(new Set([...discoveredModels, form.model].filter(Boolean)))
  const canSave = form.name.trim() && form.baseUrl.trim() && form.model.trim()

  return (
    <SettingsContent>
      <div className="space-y-6">
        <section>
          <SectionHeading
            icon={Globe}
            meta={`${endpoints.length}`}
            title={isVi ? 'Máy chủ tùy chỉnh' : 'Custom Endpoints'}
          />
          <div className="divide-y divide-border/40 rounded-md border border-border/50">
            {endpoints.length ? (
              endpoints.map(endpoint => (
                <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={endpoint.id}>
                  <button
                    className="min-w-0 text-left"
                    onClick={() => {
                      setForm(formFromEndpoint(endpoint))
                      setDiscoveredModels(endpoint.models)
                    }}
                    type="button"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{endpoint.name}</span>
                      {endpoint.is_current && (
                        <Pill tone="primary">
                          <Check className="size-3" />
                          {isVi ? 'Đang dùng' : 'Active'}
                        </Pill>
                      )}
                      {endpoint.source === 'direct-config' && <Pill>config.yaml</Pill>}
                    </div>
                    <div className="mt-1 truncate font-mono text-[0.7rem] text-muted-foreground">
                      {endpoint.base_url}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{endpoint.model}</span>
                      {endpoint.has_api_key && (
                        <span>{endpoint.api_key_preview ?? (isVi ? 'Đã đặt khóa API' : 'API key set')}</span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Button
                      disabled={endpoint.is_current || activating === endpoint.id}
                      onClick={() => void handleActivate(endpoint)}
                      size="sm"
                      variant="outline"
                    >
                      {activating === endpoint.id ? <Loader2 className="animate-spin" /> : <Zap />}
                      {isVi ? 'Dùng' : 'Use'}
                    </Button>
                    {endpoint.source !== 'direct-config' && (
                      <Button
                        className="hover:text-destructive"
                        disabled={deleting === endpoint.id}
                        onClick={() => void handleDelete(endpoint)}
                        size="icon-sm"
                        title={isVi ? 'Xóa máy chủ' : 'Delete endpoint'}
                        variant="ghost"
                      >
                        {deleting === endpoint.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                description={
                  isVi ? 'Thêm máy chủ tương thích OpenAI bên dưới.' : 'Add an OpenAI-compatible endpoint below.'
                }
                title={isVi ? 'Chưa có máy chủ tùy chỉnh' : 'No custom endpoints'}
              />
            )}
          </div>
        </section>

        <section>
          <SectionHeading
            icon={Plus}
            title={form.id ? (isVi ? 'Sửa máy chủ' : 'Edit Endpoint') : isVi ? 'Thêm máy chủ' : 'Add Endpoint'}
          />
          <div className="grid gap-3 rounded-md border border-border/50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                {isVi ? 'Tên' : 'Name'}
                <Input
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="Axet Proxy"
                  value={form.name}
                />
              </label>
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                {isVi ? 'ID nhà cung cấp' : 'Provider ID'}
                <Input
                  onChange={event => setForm(current => ({ ...current, id: event.target.value }))}
                  placeholder="axet-proxy"
                  value={form.id}
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              {isVi ? 'URL máy chủ' : 'Endpoint URL'}
              <Input
                onChange={event => setForm(current => ({ ...current, baseUrl: event.target.value }))}
                placeholder="http://127.0.0.1:8081/v1"
                value={form.baseUrl}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                {isVi ? 'Model mặc định' : 'Default Model'}
                <Input
                  list="custom-endpoint-models"
                  onChange={event => setForm(current => ({ ...current, model: event.target.value }))}
                  placeholder="gpt-5.4"
                  value={form.model}
                />
                <datalist id="custom-endpoint-models">
                  {allModelOptions.map(model => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </label>
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                {isVi ? 'Ngữ cảnh' : 'Context'}
                <Input
                  inputMode="numeric"
                  onChange={event => setForm(current => ({ ...current, contextLength: event.target.value }))}
                  placeholder={isVi ? 'Tự động' : 'Auto'}
                  value={form.contextLength}
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              {isVi ? 'Khóa API' : 'API Key'}
              <Input
                onChange={event => setForm(current => ({ ...current, apiKey: event.target.value }))}
                placeholder={
                  form.id
                    ? isVi
                      ? 'Để trống để giữ khóa hiện tại'
                      : 'Leave blank to keep current key'
                    : t.settings.credentials.optional
                }
                type="password"
                value={form.apiKey}
              />
            </label>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.makeDefault}
                  onCheckedChange={checked => setForm(current => ({ ...current, makeDefault: checked === true }))}
                />
                {isVi ? 'Dùng cho phiên mới' : 'Use for new chats'}
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.discoverModels}
                  onCheckedChange={checked => setForm(current => ({ ...current, discoverModels: checked === true }))}
                />
                {isVi ? 'Tự tìm model' : 'Discover models'}
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={testing || !form.baseUrl.trim()}
                onClick={() => void handleValidate()}
                variant="outline"
              >
                {testing ? <Loader2 className="animate-spin" /> : <Zap />}
                {isVi ? 'Kiểm tra' : 'Test'}
              </Button>
              <Button disabled={saving || !canSave} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {t.common.save}
              </Button>
              <Button
                className={cn(!form.id && 'hidden')}
                onClick={() => {
                  setForm(EMPTY_FORM)
                  setDiscoveredModels([])
                }}
                type="button"
                variant="ghost"
              >
                {isVi ? 'Máy chủ mới' : 'New endpoint'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </SettingsContent>
  )
}
