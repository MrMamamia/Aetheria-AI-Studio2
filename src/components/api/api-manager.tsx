'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, useFetch } from '@/hooks/use-fetch'
import { PROVIDERS, isReasoningModel, reasoningModelAdvice } from '@/lib/providers'
import type { ProviderCapabilities, ProviderType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
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
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [draftKey, setDraftKey] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [modelsSource, setModelsSource] = useState<'api' | 'fallback' | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const modelsTokenRef = useRef(0)

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
      // After a save that included a new apiKey, mark hasKey as true
      // but do NOT clear the local input — the user should still see their
      // key in the text box. It will reset when they navigate to another profile.
      if (snapshotKey && snapshotKey.trim().length > 0) {
        setDraft((prev) =>
          prev ? { ...prev, hasKey: true } : prev,
        )
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

  // ---- Dynamic model fetching ----
  // Fetches the provider's live model list (falling back to the built-in
  // catalog when the provider doesn't expose /models). State is only updated
  // asynchronously, after the request completes.
  const fetchModels = useCallback(async () => {
    if (!draft) return
    const token = ++modelsTokenRef.current
    try {
      const body: Record<string, unknown> = {
        provider: draft.provider,
        baseUrl: draft.baseUrl ?? undefined,
      }
      if (apiKeyInput && apiKeyInput.trim().length > 0) {
        body.apiKey = apiKeyInput
      }
      const res = await api<{ models: string[]; source: 'api' | 'fallback' }>(
        `/api/api-profiles/${draft.id}/models`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (token !== modelsTokenRef.current) return
      const list = res.models ?? []
      setModels(list)
      setModelsSource(res.source)
    } catch {
      if (token !== modelsTokenRef.current) return
      setModels([])
      setModelsSource('fallback')
    }
  }, [draft, apiKeyInput])

  const refreshModels = useCallback(async () => {
    if (!draft) return
    setModelsLoading(true)
    try {
      await fetchModels()
    } finally {
      setModelsLoading(false)
    }
  }, [draft, fetchModels])

  // Auto-fetch whenever the selected profile or its provider changes. The
  // profile switch resets the local list in the render-time sync block, so a
  // stale response is dropped via the token guard below.
  useEffect(() => {
    if (!draft) return
    const profile = draft
    const token = ++modelsTokenRef.current
    const body: Record<string, unknown> = {
      provider: profile.provider,
      baseUrl: profile.baseUrl ?? undefined,
    }
    if (apiKeyInput && apiKeyInput.trim().length > 0) {
      body.apiKey = apiKeyInput
    }
    api<{ models: string[]; source: 'api' | 'fallback' }>(
      `/api/api-profiles/${profile.id}/models`,
      { method: 'POST', body: JSON.stringify(body) },
    )
      .then((res) => {
        if (token !== modelsTokenRef.current) return
        setModels(res.models ?? [])
        setModelsSource(res.source)
      })
      .catch(() => {
        if (token !== modelsTokenRef.current) return
        setModels([])
        setModelsSource('fallback')
      })
  }, [draft?.id, draft?.provider])

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
    setModels([])
    setModelsSource(null)
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
        body: JSON.stringify({ name: 'New API Profile', provider: 'openai', modelName: 'gpt-4o' }),
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

  // ---- Universal (all characters) selection ----
  // "Select" marks the profile as the global default AND rebinds every
  // existing chat to it. "Deselect" clears the global status.
  const setUniversal = useCallback(
    async (id: string, universal: boolean) => {
      // Persist any pending autosave first so it can't race our PUT.
      await flush()
      try {
        const updated: ApiProfile = await api(`/api/api-profiles/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            isDefault: universal,
            applyToAllChats: universal,
          }),
        })
        setProfiles((prev) => {
          const cur = (prev ?? []) as ApiProfile[]
          return cur.map((p) =>
            p.id === id
              ? { ...p, ...updated }
              : universal
                ? { ...p, isDefault: false }
                : p,
          )
        })
        setDraft((prev) =>
          prev && prev.id === id ? { ...prev, ...updated } : prev,
        )
        toast.success(
          universal
            ? 'Profile selected for all characters'
            : 'Profile deselected',
        )
      } catch (e) {
        toast.error('Failed to update profile', {
          description: (e as Error).message,
        })
      }
    },
    [flush, setProfiles],
  )

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
                API profiles configure how Aetheria talks to AI providers. Add an
                OpenAI, Anthropic, Google Gemini, Groq, or custom API key to begin.
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
  const providerMeta = draft ? PROVIDERS[draft.provider] ?? PROVIDERS.openai : PROVIDERS.openai

  return (
    <div className="flex h-full flex-col">
      <ViewHeader count={profiles.length} />

      <div className="flex flex-1 overflow-auto">
        {/* ---- List ---- */}
        <aside className="flex w-80 shrink-0 flex-col border-r overflow-y-auto">
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
                const meta = PROVIDERS[p.provider] ?? PROVIDERS.openai
                return (
                  <div
                    key={p.id}
                    onClick={() => selectProfile(p.id)}
                    className={cn(
                      'group flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors',
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void setUniversal(p.id, !p.isDefault)
                      }}
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                        p.isDefault
                          ? 'border-amber-400/50 bg-amber-400/10 text-amber-500 hover:bg-amber-400/20'
                          : 'border-transparent text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100',
                      )}
                      title={
                        p.isDefault
                          ? 'Deselect — stop using this profile across all characters'
                          : 'Select — use this profile across all characters'
                      }
                    >
                      <Globe className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* ---- Editor ---- */}
        <section className="flex flex-1 flex-col overflow-auto">
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
                          placeholder="e.g. OpenAI Primary, My Groq Key, Local LM Studio"
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

                  {/* Universal usage */}
                  <Card className="gap-0 py-0">
                    <CardHeader className="gap-0 px-5 pt-4 pb-3">
                      <CardTitle className="text-sm">Universal Usage</CardTitle>
                      <CardDescription className="text-xs">
                        Use this profile across all characters and chats.
                      </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center gap-2">
                        {draft.isDefault ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 px-2 py-0.5 text-[10px]"
                          >
                            <Globe className="h-3 w-3" /> Currently universal
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            Not universal
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => void setUniversal(draft.id, true)}
                          disabled={draft.isDefault}
                        >
                          <Globe className="h-3.5 w-3.5" /> Select for all
                          characters
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => void setUniversal(draft.id, false)}
                          disabled={!draft.isDefault}
                        >
                          <Star className="h-3.5 w-3.5" /> Deselect
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selecting rebinds every existing chat to this profile
                        and makes it the default for new chats. Deselecting
                        stops it from being the global profile.
                      </p>
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
                        onValueChange={(v) => {
                          const next = v as ProviderType
                          const meta = PROVIDERS[next] ?? PROVIDERS.openai
                          update({
                            provider: next,
                            modelName: null,
                          })
                        }}
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
                              <div className="relative">
                                <Input
                                  id="apiKey"
                                  type={showKey ? 'text' : 'password'}
                                  value={apiKeyInput}
                                  onChange={(e) => updateApiKey(e.target.value)}
                                  placeholder={
                                    draft.hasKey ? '••••••••••••••••' : 'Enter API key (e.g. sk-...)'
                                  }
                                  className="pr-10"
                                  autoComplete="off"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowKey(!showKey)}
                                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                                  title={showKey ? 'Hide API key' : 'Show API key'}
                                >
                                  {showKey ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              {draft.hasKey && !apiKeyInput && (
                                <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Key saved & hidden securely. Type a new key above to update.
                                </p>
                              )}
                              {!draft.hasKey && providerMeta.needsApiKey && (
                                <p className="text-xs text-amber-600 dark:text-amber-500">
                                  No key set yet. This provider requires an API key.
                                </p>
                              )}
                              {providerMeta.apiKeyUrl && (
                                <p className="text-xs text-muted-foreground">
                                  Get your key at:{' '}
                                  <a
                                    href={providerMeta.apiKeyUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline hover:text-foreground"
                                  >
                                    {providerMeta.apiKeyUrl.replace(/^https?:\/\//, '')}
                                  </a>
                                </p>
                              )}
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor="model">Model</Label>
                              <button
                                type="button"
                                onClick={() => void refreshModels()}
                                disabled={modelsLoading}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={cn(
                                    'h-3 w-3',
                                    modelsLoading && 'animate-spin',
                                  )}
                                />
                                Refresh
                              </button>
                            </div>
                            {(() => {
                              const fallbackIds = providerMeta.defaultModels.map(
                                (m) => m.id,
                              )
                              const modelIds =
                                models.length > 0 ? models : fallbackIds
                              const allModelIds =
                                draft.modelName &&
                                !modelIds.includes(draft.modelName)
                                  ? [draft.modelName, ...modelIds]
                                  : modelIds
                              const effectiveModel = draft.modelName || ''
                              return (
                                <Select
                                  value={effectiveModel}
                                  onValueChange={(v) =>
                                    update({ modelName: v })
                                  }
                                >
                                  <SelectTrigger id="model">
                                    <SelectValue placeholder="Select model" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allModelIds.map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {m}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )
                            })()}
                            {modelsSource === 'api' && (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                Models fetched from the provider.
                              </p>
                            )}
                            {modelsSource === 'fallback' && (
                              <p className="text-xs text-muted-foreground">
                                Provider didn&apos;t list models — showing the
                                built-in catalog.
                              </p>
                            )}
                            {/* Advice banner for reasoning models */}
                            {draft.modelName &&
                              isReasoningModel(draft.modelName) && (
                                <div className="flex gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs dark:border-amber-700/50 dark:bg-amber-950/30">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <div className="space-y-1">
                                    <p className="font-medium text-amber-900 dark:text-amber-200">
                                      Reasoning model detected
                                    </p>
                                    <p className="text-amber-800 dark:text-amber-300/90">
                                      {reasoningModelAdvice(draft.modelName)}
                                    </p>
                                  </div>
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
