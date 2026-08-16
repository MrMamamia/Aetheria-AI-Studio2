'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  Copy,
  Loader2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react'

import { api, useFetch } from '@/hooks/use-fetch'
import {
  DEFAULT_GEN_PARAMS,
  DEFAULT_PROMPT_SETTINGS,
  PROVIDERS,
} from '@/lib/providers'
import type {
  GenParams,
  PromptSettings,
  ProviderCapabilities,
  ProviderType,
} from '@/lib/types'
import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================
// Types
// ============================================================

interface ApiProfileListItem {
  id: string
  name: string
  provider: ProviderType
  hasKey: boolean
  isDefault: boolean
  modelName?: string | null
}

interface PresetListItem {
  id: string
  name: string
  description?: string | null
  providerType?: string | null
  modelName?: string | null
  apiProfileId?: string | null
  genParams: string // JSON string
  promptSettings: string // JSON string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  apiProfile?: { id: string; name: string; provider: string } | null
}

interface FormState {
  id: string
  name: string
  description: string
  isDefault: boolean
  providerType: ProviderType
  modelName: string
  apiProfileId: string | null
  genParams: GenParams
  promptSettings: PromptSettings
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ============================================================
// JSON helpers
// ============================================================

function parseGenParams(raw: string | undefined | null): GenParams {
  if (!raw) return { ...DEFAULT_GEN_PARAMS }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_GEN_PARAMS, ...parsed }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_GEN_PARAMS }
}

function parsePromptSettings(raw: string | undefined | null): PromptSettings {
  if (!raw) return { ...DEFAULT_PROMPT_SETTINGS }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_PROMPT_SETTINGS, ...parsed }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PROMPT_SETTINGS }
}

function hydrateFormState(p: PresetListItem): FormState {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    isDefault: p.isDefault,
    providerType: (p.providerType as ProviderType) || 'openai',
    modelName: p.modelName ?? '',
    apiProfileId: p.apiProfileId ?? null,
    genParams: parseGenParams(p.genParams),
    promptSettings: parsePromptSettings(p.promptSettings),
  }
}

// ============================================================
// Generation parameter field config
// ============================================================

type GenFieldType = 'slider' | 'number' | 'stringArray' | 'boolean'

interface GenFieldConfig {
  key: keyof GenParams
  label: string
  type: GenFieldType
  min?: number
  max?: number
  step?: number
  description?: string
}

const GEN_FIELDS: GenFieldConfig[] = [
  { key: 'temperature', label: 'Temperature', type: 'slider', min: 0, max: 2, step: 0.05, description: 'Higher = more creative, lower = more deterministic.' },
  { key: 'topP', label: 'Top P', type: 'slider', min: 0, max: 1, step: 0.01, description: 'Nucleus sampling cutoff.' },
  { key: 'topK', label: 'Top K', type: 'slider', min: 0, max: 100, step: 1, description: 'Limit sampling to top K tokens.' },
  { key: 'minP', label: 'Min P', type: 'slider', min: 0, max: 1, step: 0.01, description: 'Minimum token probability threshold.' },
  { key: 'repetitionPenalty', label: 'Repetition Penalty', type: 'slider', min: 0.5, max: 2, step: 0.05, description: 'Penalize repeated tokens.' },
  { key: 'frequencyPenalty', label: 'Frequency Penalty', type: 'slider', min: -2, max: 2, step: 0.1, description: 'Penalize tokens by frequency.' },
  { key: 'presencePenalty', label: 'Presence Penalty', type: 'slider', min: -2, max: 2, step: 0.1, description: 'Penalize tokens that have appeared at all.' },
  { key: 'maxTokens', label: 'Max Tokens', type: 'slider', min: 64, max: 8192, step: 64, description: 'Maximum tokens to generate per response.' },
  { key: 'seed', label: 'Seed', type: 'number', description: 'Fixed seed for reproducible output. Leave empty for random.' },
  { key: 'stop', label: 'Stop Sequences', type: 'stringArray', description: 'Comma-separated strings that halt generation.' },
  { key: 'stream', label: 'Stream Response', type: 'boolean', description: 'Stream tokens as they are generated.' },
]

function formatNumber(value: number | undefined, step?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  if (step !== undefined && step < 1) {
    const decimals = Math.max(0, -Math.floor(Math.log10(step)))
    return value.toFixed(decimals)
  }
  return String(value)
}

// ============================================================
// Main component (list + selection)
// ============================================================

export function PresetsView() {
  const {
    data: presets,
    loading,
    error,
    reload: reloadPresets,
    setData: setPresets,
  } = useFetch<PresetListItem[]>('/api/presets')

  const { data: apiProfiles } = useFetch<ApiProfileListItem[]>('/api/api-profiles')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PresetListItem | null>(null)

  // Derive the effective selection: fall back to default/first preset.
  // Replaces what would have been a setState-in-effect.
  const effectiveSelectedId = useMemo(() => {
    if (!presets || presets.length === 0) return null
    if (selectedId && presets.find((p) => p.id === selectedId)) return selectedId
    const def = presets.find((p) => p.isDefault) ?? presets[0]
    return def.id
  }, [presets, selectedId])

  const selectedPreset = useMemo(
    () => presets?.find((p) => p.id === effectiveSelectedId) ?? null,
    [presets, effectiveSelectedId],
  )

  // Listen for seed completion (so the list refreshes after initial seed).
  useEffect(() => {
    const handler = () => reloadPresets()
    window.addEventListener('aetheria:seeded', handler)
    return () => window.removeEventListener('aetheria:seeded', handler)
  }, [reloadPresets])

  // ---- Actions ----

  const handleNew = useCallback(async () => {
    try {
      const created = await api<PresetListItem>('/api/presets', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Preset',
          providerType: 'openai',
          genParams: { ...DEFAULT_GEN_PARAMS },
          promptSettings: { ...DEFAULT_PROMPT_SETTINGS },
        }),
      })
      setPresets((prev) => (prev ? [created, ...prev] : [created]))
      setSelectedId(created.id)
      toast.success('Preset created')
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`)
    }
  }, [setPresets])

  const handleDuplicate = useCallback(
    async (p: PresetListItem) => {
      try {
        const gp = parseGenParams(p.genParams)
        const ps = parsePromptSettings(p.promptSettings)
        const created = await api<PresetListItem>('/api/presets', {
          method: 'POST',
          body: JSON.stringify({
            name: `${p.name} (Copy)`,
            description: p.description,
            providerType: p.providerType ?? 'openai',
            modelName: p.modelName,
            apiProfileId: p.apiProfileId,
            genParams: gp,
            promptSettings: ps,
            isDefault: false,
          }),
        })
        setPresets((prev) => (prev ? [created, ...prev] : [created]))
        setSelectedId(created.id)
        toast.success('Preset duplicated')
      } catch (e) {
        toast.error(`Duplicate failed: ${(e as Error).message}`)
      }
    },
    [setPresets],
  )

  const handleDeleteConfirm = useCallback(async () => {
    const target = pendingDelete
    if (!target) return
    const id = target.id
    setPendingDelete(null)
    try {
      await api(`/api/presets/${id}`, { method: 'DELETE' })
      setPresets((prev) => {
        const next = prev?.filter((p) => p.id !== id) ?? []
        if (selectedId === id) {
          setSelectedId(next.length ? next[0].id : null)
        }
        return next
      })
      toast.success('Preset deleted')
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`)
      reloadPresets()
    }
  }, [pendingDelete, selectedId, setPresets, reloadPresets])

  const handleSaved = useCallback(
    (updated: PresetListItem, wasDefault: boolean) => {
      setPresets((prev) => {
        if (!prev) return prev
        return prev.map((p) =>
          p.id === updated.id
            ? { ...p, ...updated, apiProfile: p.apiProfile }
            : wasDefault
              ? { ...p, isDefault: false }
              : p,
        )
      })
    },
    [setPresets],
  )

  // ============================================================
  // Render
  // ============================================================

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Failed to load presets.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reloadPresets}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* ---------------- Left: preset list ---------------- */}
      <aside className="flex w-[300px] shrink-0 flex-col border-r bg-muted/30">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Presets</h2>
            {presets && presets.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {presets.length}
              </Badge>
            )}
          </div>
          <Button size="sm" className="h-7 gap-1 px-2" onClick={handleNew}>
            <Plus className="size-3.5" />
            New
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {loading && !presets ? (
              <div className="space-y-2 p-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-md bg-muted"
                  />
                ))}
              </div>
            ) : !presets || presets.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-xs text-muted-foreground">
                  No presets yet.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={handleNew}
                >
                  <Plus className="size-3.5" />
                  Create one
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {presets.map((p) => (
                  <PresetRow
                    key={p.id}
                    preset={p}
                    selected={p.id === effectiveSelectedId}
                    onSelect={() => setSelectedId(p.id)}
                    onDuplicate={() => handleDuplicate(p)}
                    onDelete={() => setPendingDelete(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* ---------------- Right: editor ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedPreset ? (
          <PresetEditor
            key={selectedPreset.id}
            preset={selectedPreset}
            apiProfiles={apiProfiles ?? []}
            onSaved={handleSaved}
            onReloadAfterError={reloadPresets}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Select a preset to edit, or create a new one.
              </p>
              <Button size="sm" className="mt-3" onClick={handleNew}>
                <Plus className="size-3.5" />
                New Preset
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Delete confirmation ---------------- */}
      {pendingDelete && (
        <DeleteDialog
          preset={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}

// ============================================================
// PresetEditor — child component, keyed by preset.id so it
// remounts (and re-hydrates form state) on selection change.
// ============================================================

function PresetEditor({
  preset,
  apiProfiles,
  onSaved,
  onReloadAfterError,
}: {
  preset: PresetListItem
  apiProfiles: ApiProfileListItem[]
  onSaved: (updated: PresetListItem, wasDefault: boolean) => void
  onReloadAfterError: () => void
}) {
  const [formState, setFormState] = useState<FormState>(() =>
    hydrateFormState(preset),
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  // ---- Save pipeline ----

  const doSave = useCallback(
    async (state: FormState) => {
      try {
        const wasDefault = state.isDefault
        const body = {
          name: state.name || 'Untitled Preset',
          description: state.description.trim() ? state.description : null,
          isDefault: state.isDefault,
          providerType: state.providerType,
          modelName: state.modelName.trim() ? state.modelName.trim() : null,
          apiProfileId: state.apiProfileId || null,
          genParams: state.genParams,
          promptSettings: state.promptSettings,
        }
        const updated = await api<PresetListItem>(
          `/api/presets/${state.id}`,
          { method: 'PUT', body: JSON.stringify(body) },
        )
        onSaved(updated, wasDefault)
        setSaveStatus('saved')
        if (savedToastTimer.current) clearTimeout(savedToastTimer.current)
        savedToastTimer.current = setTimeout(() => {
          setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
        }, 1500)
      } catch (e) {
        setSaveStatus('error')
        toast.error(`Save failed: ${(e as Error).message}`)
        onReloadAfterError()
      }
    },
    [onSaved, onReloadAfterError],
  )

  // Debounced auto-save: fires 600ms after formState changes.
  // Skips the initial mount so we don't save unchanged data.
  // The 'saving' status is set in the patch helpers (event-handler context),
  // NOT in this effect body — calling setState synchronously in an effect
  // triggers cascading renders and is flagged by the linter.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void doSave(formState)
    }, 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [formState, doSave])

  // Cleanup toast timer on unmount.
  useEffect(() => {
    return () => {
      if (savedToastTimer.current) clearTimeout(savedToastTimer.current)
    }
  }, [])

  // ---- Patch helpers ----

  const patch = useCallback(
    (partial: Partial<FormState>) => {
      setFormState((prev) => ({ ...prev, ...partial }))
      setSaveStatus('saving')
    },
    [],
  )

  const patchGen = useCallback((partial: Partial<GenParams>) => {
    setFormState((prev) => ({
      ...prev,
      genParams: { ...prev.genParams, ...partial },
    }))
    setSaveStatus('saving')
  }, [])

  const patchPrompt = useCallback((partial: Partial<PromptSettings>) => {
    setFormState((prev) => ({
      ...prev,
      promptSettings: { ...prev.promptSettings, ...partial },
    }))
    setSaveStatus('saving')
  }, [])

  const handleResetGen = useCallback(() => {
    patchGen({ ...DEFAULT_GEN_PARAMS })
    toast.info('Generation parameters reset to defaults')
  }, [patchGen])

  const handleResetPrompt = useCallback(() => {
    patchPrompt({ ...DEFAULT_PROMPT_SETTINGS })
    toast.info('Prompt settings reset to defaults')
  }, [patchPrompt])

  // ---- Derived ----

  const capabilities: ProviderCapabilities = useMemo(() => {
    return (
      PROVIDERS[formState.providerType]?.capabilities ??
      PROVIDERS.openai.capabilities
    )
  }, [formState.providerType])

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Editor header */}
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">
              {formState.name || 'Untitled Preset'}
            </h2>
            {formState.isDefault && (
              <Badge variant="default" className="h-5 gap-1 px-1.5 text-[10px]">
                <Star className="size-2.5 fill-current" />
                Default
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {PROVIDERS[formState.providerType]?.label ?? formState.providerType}
            {formState.modelName ? ` · ${formState.modelName}` : ''}
          </p>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-4 p-5">
          {/* ----- General ----- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">General</CardTitle>
              <CardDescription>
                Basic identity and default status for this preset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="preset-name">Name</Label>
                <Input
                  id="preset-name"
                  value={formState.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g. Creative, Balanced, Precise"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset-desc">Description</Label>
                <Textarea
                  id="preset-desc"
                  value={formState.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="What is this preset good for?"
                  className="min-h-20"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="preset-default">Default Preset</Label>
                  <p className="text-xs text-muted-foreground">
                    Used automatically when creating new chats without a
                    preset selected.
                  </p>
                </div>
                <Switch
                  id="preset-default"
                  checked={formState.isDefault}
                  onCheckedChange={(v) => patch({ isDefault: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* ----- Provider & Model ----- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Provider &amp; Model</CardTitle>
              <CardDescription>
                Choose the provider and model this preset targets. Can be
                overridden per chat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Provider Type</Label>
                  <Select
                    value={formState.providerType}
                    onValueChange={(v) =>
                      patch({ providerType: v as ProviderType })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PROVIDERS) as ProviderType[]).map(
                        (key) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span>{PROVIDERS[key].label}</span>
                              {PROVIDERS[key].builtin && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 text-[9px]"
                                >
                                  Built-in
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>API Profile</Label>
                  <Select
                    value={formState.apiProfileId ?? '__none__'}
                    onValueChange={(v) =>
                      patch({
                        apiProfileId: v === '__none__' ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Inherit / none" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">
                          Inherit (none)
                        </span>
                      </SelectItem>
                      {apiProfiles
                        .filter(
                          (ap) =>
                            !formState.providerType ||
                            ap.provider === formState.providerType,
                        )
                        .map((ap) => (
                          <SelectItem key={ap.id} value={ap.id}>
                            <div className="flex items-center gap-2">
                              <span>{ap.name}</span>
                              {ap.isDefault && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 text-[9px]"
                                >
                                  Default
                                </Badge>
                              )}
                              {!ap.hasKey && (
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1 text-[9px] text-muted-foreground"
                                >
                                  No key
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="preset-model">Model Name</Label>
                <Input
                  id="preset-model"
                  value={formState.modelName}
                  onChange={(e) => patch({ modelName: e.target.value })}
                  placeholder="e.g. glm-4.6, gpt-4o, claude-3-5-sonnet-20241022"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(
                    PROVIDERS[formState.providerType]?.defaultModels ?? []
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => patch({ modelName: m.id })}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors',
                        formState.modelName === m.id
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                      title={`${m.name} · ${m.contextWindow.toLocaleString()} ctx`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {PROVIDERS[formState.providerType]?.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ----- Generation Parameters ----- */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm">
                    Generation Parameters
                  </CardTitle>
                  <CardDescription>
                    Capability-aware. Showing parameters for{' '}
                    <span className="font-medium text-foreground">
                      {PROVIDERS[formState.providerType]?.label}
                    </span>
                    .
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={handleResetGen}
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {GEN_FIELDS.map((field) => (
                <GenFieldRow
                  key={field.key}
                  field={field}
                  value={formState.genParams[field.key]}
                  supported={Boolean(
                    capabilities[field.key as keyof ProviderCapabilities],
                  )}
                  providerLabel={
                    PROVIDERS[formState.providerType]?.label ??
                    formState.providerType
                  }
                  onChange={(v) => patchGen({ [field.key]: v })}
                />
              ))}
            </CardContent>
          </Card>

          {/* ----- Context / Prompt Settings ----- */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm">
                    Context &amp; Prompt Settings
                  </CardTitle>
                  <CardDescription>
                    Controls how the prompt is assembled and trimmed before
                    sending to the model.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={handleResetPrompt}
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ps-context">Context Size</Label>
                  <Input
                    id="ps-context"
                    type="number"
                    min={1024}
                    step={1024}
                    value={formState.promptSettings.contextSize ?? ''}
                    onChange={(e) =>
                      patchPrompt({
                        contextSize: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Max tokens used for context.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ps-resp">Max Response Tokens</Label>
                  <Input
                    id="ps-resp"
                    type="number"
                    min={64}
                    step={64}
                    value={formState.promptSettings.maxResponseTokens ?? ''}
                    onChange={(e) =>
                      patchPrompt({
                        maxResponseTokens: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Reserved for the reply.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ps-recent">Recent Messages</Label>
                  <Input
                    id="ps-recent"
                    type="number"
                    min={0}
                    step={1}
                    value={formState.promptSettings.recentMessages ?? ''}
                    onChange={(e) =>
                      patchPrompt({
                        recentMessages: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Conversation turns to include.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Include in Prompt</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <IncludeToggle
                    label="Persona"
                    description="User persona card."
                    checked={!!formState.promptSettings.includePersona}
                    onChange={(v) => patchPrompt({ includePersona: v })}
                  />
                  <IncludeToggle
                    label="Scenario"
                    description="Character scenario & setting."
                    checked={!!formState.promptSettings.includeScenario}
                    onChange={(v) => patchPrompt({ includeScenario: v })}
                  />
                  <IncludeToggle
                    label="Lore"
                    description="Lorebook entries (keyword-activated)."
                    checked={!!formState.promptSettings.includeLore}
                    onChange={(v) => patchPrompt({ includeLore: v })}
                  />
                  <IncludeToggle
                    label="Memory"
                    description="Summaries & pinned facts."
                    checked={!!formState.promptSettings.includeMemory}
                    onChange={(v) => patchPrompt({ includeMemory: v })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function PresetRow({
  preset,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  preset: PresetListItem
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const providerLabel =
    PROVIDERS[preset.providerType as ProviderType]?.label ??
    preset.providerType ??
    'No provider'

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2 transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:bg-accent/50',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 pr-12">
        <span className="truncate text-sm font-medium">
          {preset.name}
        </span>
        {preset.isDefault && (
          <Star className="size-3 shrink-0 fill-primary text-primary" />
        )}
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {providerLabel}
        {preset.modelName ? ` · ${preset.modelName}` : ''}
      </p>

      {/* Hover actions */}
      <div
        className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 data-[selected=true]:opacity-100"
        data-selected={selected}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={onDuplicate}
            >
              <Copy className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Duplicate</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'saving' && (
        <>
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="size-3 text-emerald-500" />
          <span className="text-muted-foreground">Saved</span>
        </>
      )}
      {status === 'error' && (
        <span className="text-destructive">Save failed</span>
      )}
    </div>
  )
}

function GenFieldRow({
  field,
  value,
  supported,
  providerLabel,
  onChange,
}: {
  field: GenFieldConfig
  value: unknown
  supported: boolean
  providerLabel: string
  onChange: (v: GenParams[keyof GenParams]) => void
}) {
  const control = (
    <div
      className={cn(
        'transition-opacity',
        !supported && 'pointer-events-none opacity-40',
      )}
    >
      <GenControl
        field={field}
        value={value}
        onChange={onChange}
        disabled={!supported}
      />
    </div>
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm">{field.label}</Label>
          {!supported && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] text-muted-foreground"
            >
              N/A
            </Badge>
          )}
        </div>
        {field.type === 'slider' && (
          <span className="font-mono text-xs text-muted-foreground">
            {formatNumber(value as number | undefined, field.step)}
          </span>
        )}
      </div>

      {supported ? (
        control
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="block w-full">{control}</div>
          </TooltipTrigger>
          <TooltipContent>Not supported by {providerLabel}</TooltipContent>
        </Tooltip>
      )}

      {field.description && supported && (
        <p className="text-[11px] text-muted-foreground">{field.description}</p>
      )}
    </div>
  )
}

function GenControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: GenFieldConfig
  value: unknown
  onChange: (v: GenParams[keyof GenParams]) => void
  disabled: boolean
}) {
  if (field.type === 'slider') {
    const v =
      typeof value === 'number' && !Number.isNaN(value)
        ? value
        : (field.min ?? 0)
    return (
      <Slider
        value={[v]}
        min={field.min}
        max={field.max}
        step={field.step}
        disabled={disabled}
        onValueChange={(arr) => onChange(arr[0])}
      />
    )
  }

  if (field.type === 'number') {
    // seed — can be undefined (random)
    const numVal = typeof value === 'number' ? value : NaN
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          disabled={disabled}
          value={Number.isNaN(numVal) ? '' : String(numVal)}
          onChange={(e) => {
            const t = e.target.value.trim()
            if (t === '') onChange(undefined as never)
            else {
              const n = Number(t)
              if (!Number.isNaN(n)) onChange(n as never)
            }
          }}
          placeholder="Random"
          className="h-8 max-w-[160px]"
        />
        {field.key === 'seed' && !Number.isNaN(numVal) && !disabled && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => onChange(undefined as never)}
          >
            Clear
          </Button>
        )}
      </div>
    )
  }

  if (field.type === 'stringArray') {
    const arr = Array.isArray(value) ? (value as string[]) : []
    return (
      <Input
        disabled={disabled}
        value={arr.join(', ')}
        onChange={(e) => {
          const next = e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          onChange(next as never)
        }}
        placeholder="stop1, stop2, stop3"
        className="h-8"
      />
    )
  }

  if (field.type === 'boolean') {
    const checked = Boolean(value)
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onChange(v as never)}
        />
        <span className="text-xs text-muted-foreground">
          {checked ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    )
  }

  return null
}

function IncludeToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 space-y-0.5">
        <Label className="text-sm">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function DeleteDialog({
  preset,
  onCancel,
  onConfirm,
}: {
  preset: PresetListItem
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Delete preset?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently delete{' '}
          <span className="font-medium text-foreground">{preset.name}</span>.
          Chats using this preset will fall back to the default.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
