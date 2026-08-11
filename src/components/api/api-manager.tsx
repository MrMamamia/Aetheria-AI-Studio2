'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, useFetch } from '@/hooks/use-fetch'
import { PROVIDERS } from '@/lib/providers'
import type { ProviderCapabilities, ProviderType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Star,
  Trash2,
  Zap,
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

// ============================================================
// Types
// ============================================================

interface ApiProfile {
  id: string
  name: string
  provider: ProviderType
  baseUrl: string | null
  hasKey: boolean
  modelName: string | null
  capabilities: string // JSON string of ProviderCapabilities
  isDefault: boolean
  lastTestedAt: string | null
  lastTestOk: boolean | null
  createdAt: string
  updatedAt: string
}

interface TestResult {
  ok: boolean
  message: string
  model?: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_LABEL: Record<SaveState, { text: string; dot: string }> = {
  idle: { text: 'All changes saved', dot: 'bg-emerald-500/70' },
  saving: { text: 'Saving…', dot: 'bg-amber-500 animate-pulse' },
  saved: { text: 'Saved', dot: 'bg-emerald-500' },
  error: { text: 'Save failed', dot: 'bg-destructive' },
}

const AUTOSAVE_DEBOUNCE_MS = 600

// Capability labels for the read-only grid.
const CAPABILITY_LABELS: { key: keyof ProviderCapabilities; label: string }[] = [
  { key: 'stream', label: 'Streaming' },
  { key: 'systemPrompt', label: 'System Prompt' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'topP', label: 'Top P' },
  { key: 'topK', label: 'Top K' },
  { key: 'minP', label: 'Min P' },
  { key: 'repetitionPenalty', label: 'Repetition Penalty' },
  { key: 'frequencyPenalty', label: 'Frequency Penalty' },
  { key: 'presencePenalty', label: 'Presence Penalty' },
  { key: 'maxTokens', label: 'Max Tokens' },
  { key: 'stop', label: 'Stop Sequences' },
  { key: 'seed', label: 'Seed' },
]

// Build the PUT body. apiKey is only included when the user has typed a new
// value — empty/undefined tells the server to keep the existing key.
function buildPatch(draft: ApiProfile, apiKeyInput: string) {
  const patch: Record<string, unknown> = {
    name: draft.name,
    provider: draft.provider,
    baseUrl: draft.baseUrl,
    modelName: draft.modelName,
    isDefault: draft.isDefault,
  }
  if (apiKeyInput && apiKeyInput.trim().length > 0) {
    patch.apiKey = apiKeyInput
  }
  return patch
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Never'
    return d.toLocaleString()
  } catch {
    return 'Never'
  }
}

function statusDotClass(lastTestOk: boolean | null): string {
  if (lastTestOk === true) return 'bg-emerald-500'
  if (lastTestOk === false) return 'bg-destructive'
  return 'bg-muted-foreground/40'
}

function statusLabel(lastTestOk: boolean | null): string {
  if (lastTestOk === true) return 'Connected'
  if (lastTestOk === false) return 'Failed'
  return 'Untested'
}

// ============================================================
// Main view
// ============================================================

export function ApiManager() {
  const {
    data,
    loading,
    setData: setProfiles,
  } = useFetch<ApiProfile[]>('/api/api-profiles')
  const profiles = data ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ApiProfile | null>(null)
  // apiKey is kept in a separate input state — the API never echoes it back.
  // We just track the user's local keystrokes to optionally send on save.
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [draftKey, setDraftKey] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Refs mirror state so the unmount cleanup can fire a final save.
  const dirtyRef = useRef(false)
  const draftRef = useRef<ApiProfile | null>(null)
  const apiKeyRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- Persistence ----

  const persist = useCallback(
    (profile: ApiProfile, keyInput: string) => {
      return api(`/api/api-profiles/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify(buildPatch(profile, keyInput)),
      }) as Promise<ApiProfile>
    },
    [],
  )

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!dirtyRef.current || !draft) return
    const snapshot = draft
    const snapshotKey = apiKeyRef.current
    dirtyRef.current = false
    setSaveState('saving')
    try {
      const updated = await persist(snapshot, snapshotKey)
      setProfiles((prev) => {
        const cur = (prev ?? []) as ApiProfile[]
        return cur.map((p) =>
          p.id === updated.id
            ? updated
            : updated.isDefault
              ? { ...p, isDefault: false }
              : p,
        )
      })
      // After a save that included a new apiKey, clear the local input —
      // the server now stores it and reports hasKey=true.
      if (snapshotKey && snapshotKey.trim().length > 0) {
        setApiKeyInput('')
        apiKeyRef.current = ''
      }
      setSaveState('saved')
      if (savedResetRef.current) clearTimeout(savedResetRef.current)
      savedResetRef.current = setTimeout(() => {
        setSaveState((s) => (s === 'saved' ? 'idle' : s))
      }, 1500)
    } catch (e) {
      setSaveState('error')
      toast.error('Failed to save profile', {
        description: (e as Error).message,
      })
    }
  }, [draft, persist, setProfiles])

  const update = useCallback(
    (patch: Partial<ApiProfile>) => {
      setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
      dirtyRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  const updateApiKey = useCallback(
    (value: string) => {
      setApiKeyInput(value)
      apiKeyRef.current = value
      dirtyRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  // Keep refs in sync for the unmount cleanup save.
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  // ---- Selection sync (render-time "adjust state when input changes") ----

  if (!loading) {
    if (profiles.length === 0) {
      if (selectedId !== null) setSelectedId(null)
    } else if (!selectedId || !profiles.some((p) => p.id === selectedId)) {
      const def = profiles.find((p) => p.isDefault) ?? profiles[0]
      setSelectedId(def.id)
    }
  }

  if (selectedId !== draftKey) {
    const p = profiles.find((x) => x.id === selectedId) ?? null
    setDraftKey(selectedId)
    setDraft(p ? { ...p } : null)
    setApiKeyInput('')
    apiKeyRef.current = ''
    setSaveState('idle')
    setTestResult(null)
  }

  // ---- Unmount cleanup: fire-and-forget the last pending save ----

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (savedResetRef.current) clearTimeout(savedResetRef.current)
      if (dirtyRef.current && draftRef.current) {
        void persist(draftRef.current, apiKeyRef.current).catch(() => {})
      }
    }
  }, [persist])

  // ---- Actions ----

  const selectProfile = useCallback(
    (id: string) => {
      if (id === selectedId) return
      void flush()
      setSelectedId(id)
    },
    [flush, selectedId],
  )

  const createNew = useCallback(async () => {
    void flush()
    try {
      const created: ApiProfile = await api('/api/api-profiles', {
        method: 'POST',
        body: JSON.stringify({ name: 'New API Profile', provider: 'zai' }),
      })
      setProfiles((prev) => {
        const cur = (prev ?? []) as ApiProfile[]
        return created.isDefault
          ? [created, ...cur.map((p) => ({ ...p, isDefault: false }))]
          : [created, ...cur]
      })
      setSelectedId(created.id)
      toast.success('API profile created')
    } catch (e) {
      toast.error('Failed to create profile', {
        description: (e as Error).message,
      })
    }
  }, [flush, setProfiles])

  const doDelete = useCallback(async () => {
    if (!selectedId) return
    if (profiles.length <= 1) return
    const targetId = selectedId
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    dirtyRef.current = false
    try {
      await api(`/api/api-profiles/${targetId}`, { method: 'DELETE' })
      const remaining = profiles.filter((p) => p.id !== targetId)
      setProfiles(remaining)
      setDeleteOpen(false)
      setSelectedId(remaining[0]?.id ?? null)
      toast.success('API profile deleted')
    } catch (e) {
      toast.error('Failed to delete profile', {
        description: (e as Error).message,
      })
    }
  }, [selectedId, profiles, setProfiles])

  const runTest = useCallback(async () => {
    if (!draft) return
    setTesting(true)
    setTestResult(null)
    try {
      const body: Record<string, unknown> = {
        provider: draft.provider,
        baseUrl: draft.baseUrl ?? undefined,
        model: draft.modelName ?? undefined,
      }
      // The server falls back to the stored key when apiKey is absent, so
      // only attach it when the user has typed something new.
      if (apiKeyInput && apiKeyInput.trim().length > 0) {
        body.apiKey = apiKeyInput
      }
      const result: TestResult = await api(
        `/api/api-profiles/${draft.id}/test`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      setTestResult(result)
      // Mirror the updated test status into the local list + draft so the
      // status dot in the sidebar updates instantly.
      const now = new Date().toISOString()
      setProfiles((prev) => {
        const cur = (prev ?? []) as ApiProfile[]
        return cur.map((p) =>
          p.id === draft.id
            ? { ...p, lastTestedAt: now, lastTestOk: result.ok }
            : p,
        )
      })
      setDraft((prev) =>
        prev && prev.id === draft.id
          ? { ...prev, lastTestedAt: now, lastTestOk: result.ok }
          : prev,
      )
      if (result.ok) {
        toast.success('Connection test succeeded')
      } else {
        toast.error('Connection test failed', { description: result.message })
      }
    } catch (e) {
      const msg = (e as Error).message
      setTestResult({ ok: false, message: msg })
      toast.error('Connection test failed', { description: msg })
    } finally {
      setTesting(false)
    }
  }, [draft, apiKeyInput, setProfiles])

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader count={0} />
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>No API profiles</CardTitle>
              <CardDescription>
                API profiles configure how Halcyon talks to AI providers. The
                built-in Z.AI Cloud profile works out of the box.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={createNew} className="w-full">
                <Plus /> Create your first profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const save = SAVE_LABEL[saveState]
  const isOnlyProfile = profiles.length <= 1
  const providerMeta = draft ? PROVIDERS[draft.provider] ?? PROVIDERS.zai : PROVIDERS.zai

  return (
    <div className="flex h-full flex-col">
      <ViewHeader count={profiles.length} />

      <div className="flex flex-1 overflow-hidden">
        {/* ---- List ---- */}
        <aside className="flex w-80 shrink-0 flex-col border-r">
          <div className="border-b p-3">
            <Button
              onClick={createNew}
              variant="outline"
              className="w-full justify-start"
            >
              <Plus /> New Profile
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-0.5 p-2">
              {profiles.map((p) => {
                const selected = p.id === selectedId
                const meta = PROVIDERS[p.provider] ?? PROVIDERS.zai
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProfile(p.id)}
                    className={cn(
                      'group flex items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        statusDotClass(p.lastTestOk),
                      )}
                      title={statusLabel(p.lastTestOk)}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {p.name || 'Untitled'}
                        </span>
                        {p.isDefault && (
                          <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="shrink-0 px-1.5 py-0 text-[10px]"
                        >
                          {meta.label}
                        </Badge>
                        {meta.builtin && (
                          <Badge
                            variant="outline"
                            className="shrink-0 px-1.5 py-0 text-[10px] text-muted-foreground"
                          >
                            Built-in
                          </Badge>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {statusLabel(p.lastTestOk)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* ---- Editor ---- */}
        <section className="flex flex-1 flex-col overflow-hidden">
          {draft ? (
            <>
              <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
                <span className="truncate text-sm font-semibold">
                  {draft.name || 'Untitled profile'}
                </span>
                {draft.isDefault && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    Default
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', save.dot)} />
                    <span>{save.text}</span>
                  </div>
                  <Separator orientation="vertical" className="h-5" />
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete &ldquo;{draft.name || 'Untitled'}&rdquo;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {isOnlyProfile ? (
                            <span className="text-destructive">
                              This is the only API profile. Halcyon needs at
                              least one profile to function. Create another
                              profile first before deleting this one.
                            </span>
                          ) : (
                            <>
                              This API profile will be permanently removed.
                              Chats and presets that reference it will lose
                              their API profile binding.
                            </>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={doDelete}
                          disabled={isOnlyProfile}
                          className={cn(
                            'bg-destructive text-white hover:bg-destructive/90',
                            isOnlyProfile && 'pointer-events-none opacity-50',
                          )}
                        >
                          Delete profile
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="mx-auto max-w-3xl space-y-5 p-6">
                  {/* Identity */}
                  <Card className="gap-0 py-0">
                    <CardHeader className="gap-0 px-5 pt-4 pb-3">
                      <CardTitle className="text-sm">Identity</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="space-y-4 p-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={draft.name}
                          onChange={(e) => update({ name: e.target.value })}
                          placeholder="e.g. Z.AI Cloud, My OpenAI Key, Local LM Studio"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="isDefault" className="text-sm">
                            Default profile
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Used by default when creating new chats. Only one
                            profile can be the default.
                          </p>
                        </div>
                        <Switch
                          id="isDefault"
                          checked={draft.isDefault}
                          onCheckedChange={(v) => update({ isDefault: v })}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Provider */}
                  <Card className="gap-0 py-0">
                    <CardHeader className="gap-0 px-5 pt-4 pb-3">
                      <CardTitle className="text-sm">Provider</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="space-y-2 p-5">
                      <Label htmlFor="provider">Provider</Label>
                      <Select
                        value={draft.provider}
                        onValueChange={(v) =>
                          update({ provider: v as ProviderType })
                        }
                      >
                        <SelectTrigger id="provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PROVIDERS).map(([key, meta]) => (
                            <SelectItem key={key} value={key}>
                              {meta.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {providerMeta.description}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Connection */}
                  <Card className="gap-0 py-0">
                    <CardHeader className="gap-0 px-5 pt-4 pb-3">
                      <CardTitle className="text-sm">Connection</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="space-y-4 p-5">
                      {providerMeta.builtin ? (
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <div className="space-y-0.5">
                            <p className="font-medium">
                              No configuration required
                            </p>
                            <p className="text-xs text-muted-foreground">
                              This provider works out of the box — no base URL
                              or API key needed.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {providerMeta.needsBaseUrl && (
                            <div className="space-y-1.5">
                              <Label htmlFor="baseUrl">Base URL</Label>
                              <Input
                                id="baseUrl"
                                value={draft.baseUrl ?? ''}
                                onChange={(e) =>
                                  update({ baseUrl: e.target.value })
                                }
                                placeholder="http://localhost:1234/v1"
                              />
                              <p className="text-xs text-muted-foreground">
                                e.g. http://localhost:1234/v1 — the
                                OpenAI-compatible endpoint, without a trailing
                                slash.
                              </p>
                            </div>
                          )}

                          {(providerMeta.needsApiKey ||
                            draft.provider === 'openai-compatible') && (
                            <div className="space-y-1.5">
                              <Label htmlFor="apiKey" className="flex items-center gap-1">
                                API Key
                                {draft.provider === 'openai-compatible' && (
                                  <span className="text-xs font-normal text-muted-foreground">
                                    (optional)
                                  </span>
                                )}
                              </Label>
                              <Input
                                id="apiKey"
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => updateApiKey(e.target.value)}
                                placeholder={
                                  draft.hasKey ? '••••••••••••' : 'sk-...'
                                }
                                autoComplete="off"
                              />
                              {draft.hasKey && !apiKeyInput && (
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <KeyRound className="h-3 w-3" />
                                  Key saved — leave blank to keep the existing
                                  one.
                                </p>
                              )}
                              {!draft.hasKey &&
                                providerMeta.needsApiKey && (
                                  <p className="text-xs text-amber-600 dark:text-amber-500">
                                    No key set yet. This provider requires an
                                    API key.
                                  </p>
                                )}
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <Label htmlFor="model">Model</Label>
                            <Input
                              id="model"
                              value={draft.modelName ?? ''}
                              onChange={(e) =>
                                update({ modelName: e.target.value })
                              }
                              placeholder="Model identifier"
                            />
                            {providerMeta.defaultModels.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-xs text-muted-foreground">
                                  Quick pick:
                                </span>
                                {providerMeta.defaultModels.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => update({ modelName: m.id })}
                                    className={cn(
                                      'rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-accent',
                                      draft.modelName === m.id
                                        ? 'border-primary bg-primary/10 text-foreground'
                                        : 'text-muted-foreground',
                                    )}
                                    title={`${m.name} · ${m.contextWindow.toLocaleString()} context`}
                                  >
                                    {m.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Connection Test */}
                  <Card className="gap-0 py-0">
                    <CardHeader className="gap-0 px-5 pt-4 pb-3">
                      <CardTitle className="text-sm">
                        Connection Test
                      </CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={runTest}
                          disabled={testing}
                          size="sm"
                        >
                          {testing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Zap className="h-3.5 w-3.5" />
                          )}
                          {testing ? 'Testing…' : 'Test Connection'}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Last tested:{' '}
                          <span className="font-medium text-foreground">
                            {formatTimestamp(draft.lastTestedAt)}
                          </span>
                        </span>
                      </div>

                      {testResult ? (
                        <div
                          className={cn(
                            'flex items-start gap-2 rounded-lg border p-3 text-sm',
                            testResult.ok
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : 'border-destructive/30 bg-destructive/5',
                          )}
                        >
                          {testResult.ok ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          )}
                          <div className="space-y-0.5">
                            <p className="font-medium">
                              {testResult.ok
                                ? 'Connection successful'
                                : 'Connection failed'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {testResult.message}
                            </p>
                          </div>
                        </div>
                      ) : (
                        draft.lastTestedAt && (
                          <div
                            className={cn(
                              'flex items-start gap-2 rounded-lg border p-3 text-sm',
                              draft.lastTestOk
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-destructive/30 bg-destructive/5',
                            )}
                          >
                            {draft.lastTestOk ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            )}
                            <div className="space-y-0.5">
                              <p className="font-medium">
                                {draft.lastTestOk
                                  ? 'Last test successful'
                                  : 'Last test failed'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Tested at{' '}
                                {formatTimestamp(draft.lastTestedAt)}. Run a
                                new test to verify the current configuration.
                              </p>
                            </div>
                          </div>
                        )
                      )}

                      <p className="text-xs text-muted-foreground">
                        The test sends a minimal request to the provider. If
                        you haven&apos;t entered a new API key above, the
                        server uses the stored key.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Capabilities */}
                  <Card className="gap-0 py-0">
                    <CardHeader className="gap-0 px-5 pt-4 pb-3">
                      <CardTitle className="text-sm">Capabilities</CardTitle>
                      <CardDescription className="text-xs">
                        Read-only capability matrix for{' '}
                        {providerMeta.label}. Used by the generation engine to
                        decide which parameters to forward.
                      </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-5">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {CAPABILITY_LABELS.map(({ key, label }) => {
                          const caps = providerMeta.capabilities
                          const ok = caps ? caps[key] : false
                          return (
                            <div
                              key={key}
                              className={cn(
                                'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                                ok
                                  ? 'border-emerald-500/30 bg-emerald-500/5'
                                  : 'border-border bg-muted/30',
                              )}
                            >
                              <span className="text-foreground">{label}</span>
                              {ok ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              ) : (
                                <span className="text-muted-foreground">×</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security note */}
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      API keys are stored locally and never sent to any server
                      except the provider you configure. They are never logged
                      or exposed in debug views.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <div className="space-y-2">
                <Zap className="mx-auto h-6 w-6 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  Select a profile to edit, or create a new one.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function ViewHeader({ count }: { count: number }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b px-6">
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight tracking-tight">
          API Profiles
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          Configure AI provider connections. The default profile is used for
          new chats.
        </p>
      </div>
      <Badge variant="secondary" className="px-2 py-0.5 text-xs">
        {count} {count === 1 ? 'profile' : 'profiles'}
      </Badge>
    </div>
  )
}
