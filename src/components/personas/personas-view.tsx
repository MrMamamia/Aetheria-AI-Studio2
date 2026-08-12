'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, useFetch } from '@/hooks/use-fetch'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Sparkles, Plus, Trash2, MessageSquare, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface Persona {
  id: string
  name: string
  description: string | null
  personality: string | null
  background: string | null
  appearance: string | null
  behavior: string | null
  speakingStyle: string | null
  customInstructions: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_LABEL: Record<SaveState, { text: string; dot: string }> = {
  idle: { text: 'All changes saved', dot: 'bg-emerald-500/70' },
  saving: { text: 'Saving…', dot: 'bg-amber-500 animate-pulse' },
  saved: { text: 'Saved', dot: 'bg-emerald-500' },
  error: { text: 'Save failed', dot: 'bg-destructive' },
}

const AUTOSAVE_DEBOUNCE_MS = 600

// Body fields sent on every PUT. Kept in sync with the API update handler.
function buildPatch(p: Persona) {
  return {
    name: p.name,
    description: p.description,
    personality: p.personality,
    background: p.background,
    appearance: p.appearance,
    behavior: p.behavior,
    speakingStyle: p.speakingStyle,
    customInstructions: p.customInstructions,
    isDefault: p.isDefault,
  }
}

// ---------------------------------------------------------------
// Main view
// ---------------------------------------------------------------

export function PersonasView() {
  const { data, loading, setData: setPersonas } = useFetch<Persona[]>('/api/personas')
  const personas = data ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Persona | null>(null)
  // Tracks which persona id the current draft corresponds to, so we can
  // detect selection changes and resync the working copy.
  const [draftKey, setDraftKey] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const activePersonaId = useAppStore((s) => s.activePersonaId)

  // dirtyRef tracks unsaved edits; draftRef mirrors `draft` so the unmount
  // cleanup can fire a final save. Both are only mutated in event handlers
  // and effects (never during render) to satisfy react-hooks/refs.
  const dirtyRef = useRef(false)
  const draftRef = useRef<Persona | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- Persistence ----

  const persist = useCallback((persona: Persona) => {
    return api(`/api/personas/${persona.id}`, {
      method: 'PUT',
      body: JSON.stringify(buildPatch(persona)),
    }) as Promise<Persona>
  }, [])

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!dirtyRef.current || !draft) return
    const snapshot = draft
    dirtyRef.current = false
    setSaveState('saving')
    try {
      const updated = await persist(snapshot)
      // Merge the saved row back into the list. If this persona is now the
      // default, the server has already cleared isDefault on every other row —
      // mirror that locally so the badges update instantly.
      setPersonas((prev) => {
        const cur = (prev ?? []) as Persona[]
        return cur.map((p) =>
          p.id === updated.id
            ? updated
            : updated.isDefault
              ? { ...p, isDefault: false }
              : p,
        )
      })
      setSaveState('saved')
      if (savedResetRef.current) clearTimeout(savedResetRef.current)
      savedResetRef.current = setTimeout(() => {
        setSaveState((s) => (s === 'saved' ? 'idle' : s))
      }, 1500)
    } catch (e) {
      setSaveState('error')
      toast.error('Failed to save persona', { description: (e as Error).message })
    }
  }, [draft, persist, setPersonas])

  const update = useCallback(
    (patch: Partial<Persona>) => {
      setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
      dirtyRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  // Keep draftRef in sync with draft state (for unmount cleanup only).
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  // ---- Selection sync (render-time, React's "adjust state when input changes" pattern) ----

  // Pick a sensible default selection once data is loaded. This runs during
  // render but only calls setSelectedId when the value actually needs to
  // change, so it cannot loop.
  if (!loading) {
    if (personas.length === 0) {
      if (selectedId !== null) setSelectedId(null)
    } else if (!selectedId || !personas.some((p) => p.id === selectedId)) {
      const def = personas.find((p) => p.isDefault) ?? personas[0]
      setSelectedId(def.id)
    }
  }

  // Resync the working draft whenever the selection changes.
  if (selectedId !== draftKey) {
    const p = personas.find((x) => x.id === selectedId) ?? null
    setDraftKey(selectedId)
    setDraft(p ? { ...p } : null)
    setSaveState('idle')
  }

  // ---- Unmount cleanup: fire-and-forget the last pending save ----

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (savedResetRef.current) clearTimeout(savedResetRef.current)
      if (dirtyRef.current && draftRef.current) {
        void persist(draftRef.current).catch(() => {})
      }
    }
  }, [persist])

  // ---- Actions ----

  const selectPersona = useCallback(
    (id: string) => {
      if (id === selectedId) return
      // Flush the current persona's pending edits before switching so
      // nothing is lost.
      void flush()
      setSelectedId(id)
    },
    [flush, selectedId],
  )

  const createNew = useCallback(async () => {
    void flush()
    try {
      const created: Persona = await api('/api/personas', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Persona' }),
      })
      setPersonas((prev) => {
        const cur = (prev ?? []) as Persona[]
        return created.isDefault
          ? [created, ...cur.map((p) => ({ ...p, isDefault: false }))]
          : [created, ...cur]
      })
      setSelectedId(created.id)
      toast.success('Persona created')
    } catch (e) {
      toast.error('Failed to create persona', { description: (e as Error).message })
    }
  }, [flush, setPersonas])

  const doDelete = useCallback(async () => {
    if (!selectedId) return
    const targetId = selectedId
    // Clear pending edits for the persona being deleted.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    dirtyRef.current = false
    try {
      await api(`/api/personas/${targetId}`, { method: 'DELETE' })
      const remaining = personas.filter((p) => p.id !== targetId)
      setPersonas(remaining)
      setDeleteOpen(false)
      setSelectedId(remaining[0]?.id ?? null)
      toast.success('Persona deleted')
    } catch (e) {
      toast.error('Failed to delete persona', { description: (e as Error).message })
    }
  }, [selectedId, personas, setPersonas])

  const useAsActive = useCallback(() => {
    if (!selectedId) return
    useAppStore.getState().setActivePersona(selectedId)
    useAppStore.getState().setView('chat')
  }, [selectedId])

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (personas.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader count={0} />
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>No personas yet</CardTitle>
              <CardDescription>
                Personas represent you in conversations. The active persona is
                injected into the model context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={createNew} className="w-full">
                <Plus /> Create your first persona
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const save = SAVE_LABEL[saveState]
  const isActivePersona = activePersonaId === selectedId

  return (
    <div className="flex h-full flex-col">
      <ViewHeader count={personas.length} />

      <div className="flex flex-1 overflow-hidden">
        {/* ---- List ---- */}
        <aside className="flex w-80 shrink-0 flex-col border-r">
          <div className="border-b p-3">
            <Button
              onClick={createNew}
              variant="outline"
              className="w-full justify-start"
            >
              <Plus /> New Persona
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-0.5 p-2">
              {personas.map((p) => {
                const selected = p.id === selectedId
                const isActive = p.id === activePersonaId
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPersona(p.id)}
                    className={cn(
                      'group flex items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {p.name || 'Untitled'}
                        </span>
                        {p.isDefault && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 px-1.5 py-0 text-[10px]"
                          >
                            Default
                          </Badge>
                        )}
                      </div>
                      {p.description ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      ) : (
                        <p className="line-clamp-1 text-xs italic text-muted-foreground/60">
                          No description
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        title="Active persona"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* ---- Editor ---- */}
        <section className="flex flex-1 flex-col overflow-hidden">
          {draft ? (
            <>
              <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
                <span className="truncate text-sm font-semibold">
                  {draft.name || 'Untitled persona'}
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
                  <Button
                    variant={isActivePersona ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={useAsActive}
                    className="h-8 gap-1.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {isActivePersona ? 'Active' : 'Use as active'}
                  </Button>
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
                          This persona will be permanently removed. Existing
                          chats that reference it will have no persona set.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={doDelete}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Delete persona
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-4xl space-y-8 p-6">
                  {/* Identity */}
                  <section className="space-y-4">
                    <SectionLabel>Identity</SectionLabel>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={draft.name}
                        onChange={(e) => update({ name: e.target.value })}
                        placeholder="e.g. Alex, The Traveler, Narrator"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="isDefault" className="text-sm">
                          Default persona
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Used by default when creating new chats. Only one
                          persona can be the default.
                        </p>
                      </div>
                      <Switch
                        id="isDefault"
                        checked={draft.isDefault}
                        onCheckedChange={(v) => update({ isDefault: v })}
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Overview */}
                  <section className="space-y-4">
                    <SectionLabel>Overview</SectionLabel>
                    <div className="space-y-1.5">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={draft.description ?? ''}
                        onChange={(e) => update({ description: e.target.value })}
                        placeholder="A short summary of who this persona is."
                        rows={3}
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Profile */}
                  <section className="space-y-4">
                    <SectionLabel>Profile</SectionLabel>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="personality">Personality</Label>
                        <Textarea
                          id="personality"
                          value={draft.personality ?? ''}
                          onChange={(e) => update({ personality: e.target.value })}
                          placeholder="Traits, temperament, outlook."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="background">Background</Label>
                        <Textarea
                          id="background"
                          value={draft.background ?? ''}
                          onChange={(e) => update({ background: e.target.value })}
                          placeholder="History, origin, context."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="appearance">Appearance</Label>
                        <Textarea
                          id="appearance"
                          value={draft.appearance ?? ''}
                          onChange={(e) => update({ appearance: e.target.value })}
                          placeholder="Physical description, attire."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="behavior">Behavior</Label>
                        <Textarea
                          id="behavior"
                          value={draft.behavior ?? ''}
                          onChange={(e) => update({ behavior: e.target.value })}
                          placeholder="Mannerisms, habits, typical actions."
                          rows={4}
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Voice */}
                  <section className="space-y-4">
                    <SectionLabel>Voice</SectionLabel>
                    <div className="space-y-1.5">
                      <Label htmlFor="speakingStyle">Speaking Style</Label>
                      <Textarea
                        id="speakingStyle"
                        value={draft.speakingStyle ?? ''}
                        onChange={(e) => update({ speakingStyle: e.target.value })}
                        placeholder="Tone, vocabulary, pacing, verbal quirks."
                        rows={3}
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Instructions */}
                  <section className="space-y-4">
                    <SectionLabel>Instructions</SectionLabel>
                    <div className="space-y-1.5">
                      <Label htmlFor="customInstructions">
                        Custom Instructions
                      </Label>
                      <Textarea
                        id="customInstructions"
                        value={draft.customInstructions ?? ''}
                        onChange={(e) =>
                          update({ customInstructions: e.target.value })
                        }
                        placeholder="Raw instructions injected into the model context for this persona."
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        Appended to the persona section of the prompt. Use for
                        any custom guidance the model should follow.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <div className="space-y-2">
                <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  Select a persona to edit, or create a new one.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

function ViewHeader({ count }: { count: number }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b px-6">
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight tracking-tight">
          Personas
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          Personas represent you in conversations. The active persona is
          injected into the model context.
        </p>
      </div>
      <Badge variant="secondary" className="px-2 py-0.5 text-xs">
        {count} {count === 1 ? 'persona' : 'personas'}
      </Badge>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}
