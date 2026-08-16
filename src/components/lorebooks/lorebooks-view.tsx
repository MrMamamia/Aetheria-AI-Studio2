'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  Plus,
  Search,
  Settings2,
  Trash2,
  Globe,
  Sparkles,
  KeyRound,
  Hash,
  CornerDownRight,
  Info,
  Loader2,
  ChevronRight,
} from 'lucide-react'

import { api, useFetch } from '@/hooks/use-fetch'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

// ============================================================
// Types
// ============================================================

type Activation = 0 | 1 | 2 // 0=keyword, 1=constant, 2=selective
type Position = 0 | 1 | 2 // 0=before char, 1=after char, 2=at end

interface LoreEntryT {
  id: string
  lorebookId: string
  keys: string | string[]
  aliases: string | string[]
  content: string
  comment: string | null
  enabled: boolean
  position: number
  order: number
  depth: number
  weight: number
  activation: number
  logic: string | null
  caseSensitive: boolean
  wholeWord: boolean
  createdAt: string
  updatedAt: string
}

interface LorebookListItemT {
  id: string
  name: string
  description: string | null
  tokenBudget: number
  scanDepth: number
  enabled: boolean
  boundCharacters: string
  createdAt: string
  updatedAt: string
  _count: { entries: number }
}

interface LorebookDetailT extends Omit<LorebookListItemT, '_count'> {
  entries: LoreEntryT[]
}

interface CharacterT {
  id: string
  name: string
  avatar: string | null
}

interface EntryDraft {
  id: string
  keys: string[]
  aliases: string[]
  content: string
  comment: string
  enabled: boolean
  position: number
  order: number
  depth: number
  weight: number
  activation: number
  caseSensitive: boolean
  wholeWord: boolean
}

// ============================================================
// Helpers
// ============================================================

function parseArr(s: string | string[] | null | undefined): string[] {
  if (Array.isArray(s)) return s.map(String)
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

function joinArr(arr: string[]): string {
  return arr.join(', ')
}

function splitArr(s: string): string[] {
  return s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
}

function entryToDraft(e: LoreEntryT): EntryDraft {
  return {
    id: e.id,
    keys: parseArr(e.keys),
    aliases: parseArr(e.aliases),
    content: e.content ?? '',
    comment: e.comment ?? '',
    enabled: e.enabled,
    position: e.position,
    order: e.order,
    depth: e.depth,
    weight: e.weight,
    activation: e.activation,
    caseSensitive: e.caseSensitive,
    wholeWord: e.wholeWord,
  }
}

function draftToPayload(d: EntryDraft) {
  return {
    keys: d.keys,
    aliases: d.aliases,
    content: d.content,
    comment: d.comment || null,
    enabled: d.enabled,
    position: d.position,
    order: d.order,
    depth: d.depth,
    weight: d.weight,
    activation: d.activation,
    caseSensitive: d.caseSensitive,
    wholeWord: d.wholeWord,
  }
}

const ACTIVATION_LABEL: Record<number, string> = {
  0: 'Keyword',
  1: 'Constant',
  2: 'Selective',
}

const POSITION_LABEL: Record<number, string> = {
  0: 'Before Character',
  1: 'After Character',
  2: 'At End',
}

function activationBadgeClass(a: number): string {
  switch (a) {
    case 1:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 2:
      return 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

// ============================================================
// Main component
// ============================================================

export function LorebooksView() {
  // Lorebook list state
  const {
    data: lorebooks,
    loading: booksLoading,
    error: booksError,
    setData: setBooks,
  } = useFetch<LorebookListItemT[]>('/api/lorebooks')

  const [search, setSearch] = useState('')
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<'simple' | 'advanced'>('simple')

  // Filtered lorebook list
  const filteredBooks = useMemo(() => {
    if (!lorebooks) return []
    const q = search.trim().toLowerCase()
    if (!q) return lorebooks
    return lorebooks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description ?? '').toLowerCase().includes(q),
    )
  }, [lorebooks, search])

  // Effective selected book id — falls back to first book when the current
  // selection is missing or invalid. Derived during render (no effect) to
  // avoid cascading re-renders.
  const effectiveBookId = useMemo<string | null>(() => {
    if (!lorebooks || lorebooks.length === 0) return null
    if (selectedBookId && lorebooks.some((b) => b.id === selectedBookId)) {
      return selectedBookId
    }
    return lorebooks[0].id
  }, [lorebooks, selectedBookId])

  // Selected lorebook detail
  const {
    data: bookDetail,
    loading: bookLoading,
    error: bookError,
    setData: setBookDetail,
  } = useFetch<LorebookDetailT>(
    effectiveBookId ? `/api/lorebooks/${effectiveBookId}` : null,
  )

  // Effective selected entry id — falls back to first entry when invalid.
  // Derived during render so book switches don't require a state-reset effect.
  const effectiveEntryId = useMemo<string | null>(() => {
    if (!bookDetail) return null
    if (!bookDetail.entries.length) return null
    if (selectedEntryId && bookDetail.entries.some((e) => e.id === selectedEntryId)) {
      return selectedEntryId
    }
    return bookDetail.entries[0].id
  }, [bookDetail, selectedEntryId])

  // Characters for bound-characters multi-select
  const { data: characters } = useFetch<CharacterT[]>('/api/characters')

  // ---- Lorebook operations ----

  const createLorebook = useCallback(async () => {
    try {
      const created = await api<LorebookListItemT>('/api/lorebooks', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Lorebook' }),
      })
      setBooks((prev) => [created, ...(prev ?? [])])
      setSelectedBookId(created.id)
      toast.success('Lorebook created')
    } catch (e) {
      toast.error('Failed to create lorebook', { description: (e as Error).message })
    }
  }, [setBooks])

  const deleteLorebook = useCallback(
    async (id: string) => {
      try {
        await api(`/api/lorebooks/${id}`, { method: 'DELETE' })
        setBooks((prev) => (prev ?? []).filter((b) => b.id !== id))
        if (selectedBookId === id) {
          setSelectedBookId(null)
          setSelectedEntryId(null)
        }
        toast.success('Lorebook deleted')
      } catch (e) {
        toast.error('Failed to delete lorebook', { description: (e as Error).message })
      }
    },
    [setBooks, selectedBookId],
  )

  const updateLorebook = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const updated = await api<LorebookDetailT>(`/api/lorebooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
      // Update list summary (name, enabled, boundCharacters, _count)
      setBooks((prev) =>
        (prev ?? []).map((b) =>
          b.id === id
            ? {
                ...b,
                name: updated.name,
                description: updated.description,
                enabled: updated.enabled,
                boundCharacters: updated.boundCharacters,
                tokenBudget: updated.tokenBudget,
                scanDepth: updated.scanDepth,
              }
            : b,
        ),
      )
      // Update detail cache
      setBookDetail((prev) =>
        prev && prev.id === id
          ? { ...prev, ...updated, entries: prev.entries }
          : prev,
      )
      return updated
    },
    [setBooks, setBookDetail],
  )

  const toggleBookEnabled = useCallback(
    async (book: LorebookListItemT) => {
      // Optimistic
      setBooks((prev) =>
        (prev ?? []).map((b) =>
          b.id === book.id ? { ...b, enabled: !b.enabled } : b,
        ),
      )
      try {
        await updateLorebook(book.id, { enabled: !book.enabled })
      } catch (e) {
        // Rollback
        setBooks((prev) =>
          (prev ?? []).map((b) =>
            b.id === book.id ? { ...b, enabled: book.enabled } : b,
          ),
        )
        toast.error('Failed to toggle lorebook', { description: (e as Error).message })
      }
    },
    [setBooks, updateLorebook],
  )

  // ---- Entry operations ----

  const createEntry = useCallback(async () => {
    if (!effectiveBookId) return
    try {
      const created = await api<LoreEntryT>(
        `/api/lorebooks/${effectiveBookId}/entries`,
        {
          method: 'POST',
          body: JSON.stringify({ keys: [], content: '' }),
        },
      )
      // Insert into detail cache at the end (server orders by order asc, createdAt asc)
      setBookDetail((prev) =>
        prev ? { ...prev, entries: [...prev.entries, created] } : prev,
      )
      setBooks((prev) =>
        (prev ?? []).map((b) =>
          b.id === effectiveBookId
            ? { ...b, _count: { entries: b._count.entries + 1 } }
            : b,
        ),
      )
      setSelectedEntryId(created.id)
      toast.success('Entry created')
    } catch (e) {
      toast.error('Failed to create entry', { description: (e as Error).message })
    }
  }, [effectiveBookId, setBookDetail, setBooks])

  const deleteEntry = useCallback(
    async (entryId: string) => {
      if (!bookDetail) return
      try {
        await api(`/api/loreentries/${entryId}`, { method: 'DELETE' })
        const remaining = bookDetail.entries.filter((e) => e.id !== entryId)
        setBookDetail((prev) =>
          prev ? { ...prev, entries: remaining } : prev,
        )
        setBooks((prev) =>
          (prev ?? []).map((b) =>
            b.id === bookDetail.id
              ? { ...b, _count: { entries: Math.max(0, b._count.entries - 1) } }
              : b,
          ),
        )
        if (effectiveEntryId === entryId) {
          setSelectedEntryId(remaining[0]?.id ?? null)
        }
        toast.success('Entry deleted')
      } catch (e) {
        toast.error('Failed to delete entry', { description: (e as Error).message })
      }
    },
    [bookDetail, effectiveEntryId, setBookDetail, setBooks],
  )

  const patchEntryInCache = useCallback(
    (entryId: string, patch: Partial<LoreEntryT>) => {
      setBookDetail((prev) =>
        prev
          ? {
              ...prev,
              entries: prev.entries.map((e) =>
                e.id === entryId ? ({ ...e, ...patch } as LoreEntryT) : e,
              ),
            }
          : prev,
      )
    },
    [setBookDetail],
  )

  // Toggle an entry's enabled flag from the entry row.
  // Patches cache (so the row re-renders) and dispatches a custom event
  // so the entry editor (which holds its own draft) can stay in sync without
  // triggering a redundant save.
  const toggleEntryEnabled = useCallback(
    async (entryId: string, enabled: boolean) => {
      // Optimistic cache update
      patchEntryInCache(entryId, { enabled })
      // Notify the editor to merge into its draft (and mark as synced)
      window.dispatchEvent(
        new CustomEvent('halcyon:entry-patch', {
          detail: { id: entryId, patch: { enabled } },
        }),
      )
      try {
        await api(`/api/loreentries/${entryId}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        })
      } catch (e) {
        // Rollback
        patchEntryInCache(entryId, { enabled: !enabled })
        window.dispatchEvent(
          new CustomEvent('halcyon:entry-patch', {
            detail: { id: entryId, patch: { enabled: !enabled } },
          }),
        )
        toast.error('Failed to toggle entry', { description: (e as Error).message })
      }
    },
    [patchEntryInCache],
  )

  const selectedEntry = useMemo(
    () => bookDetail?.entries.find((e) => e.id === effectiveEntryId) ?? null,
    [bookDetail, effectiveEntryId],
  )

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* LEFT — lorebook list */}
      <aside className="flex w-[280px] shrink-0 flex-col border-r bg-card/30">
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Lorebooks
          </div>
          <Button size="sm" variant="default" className="h-7 gap-1 px-2" onClick={createLorebook}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lorebooks…"
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-2">
            {booksLoading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : booksError ? (
              <div className="p-4 text-xs text-destructive">{booksError}</div>
            ) : filteredBooks.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-6 w-6" />}
                title={search ? 'No matches' : 'No lorebooks'}
                description={
                  search
                    ? 'Try a different search.'
                    : 'Create your first lorebook to start collecting world info.'
                }
                action={
                  !search ? (
                    <Button size="sm" variant="outline" className="mt-2" onClick={createLorebook}>
                      <Plus className="h-3.5 w-3.5" />
                      New Lorebook
                    </Button>
                  ) : null
                }
              />
            ) : (
              filteredBooks.map((b) => (
                <LorebookRow
                  key={b.id}
                  book={b}
                  active={b.id === effectiveBookId}
                  onClick={() => setSelectedBookId(b.id)}
                  onToggleEnabled={() => toggleBookEnabled(b)}
                  onDelete={() => deleteLorebook(b.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* MIDDLE — entry list */}
      <aside className="flex w-[360px] shrink-0 flex-col border-r bg-card/20">
        {bookLoading && !bookDetail ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading entries…
          </div>
        ) : bookError ? (
          <div className="p-4 text-xs text-destructive">{bookError}</div>
        ) : !bookDetail ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="No lorebook selected"
              description="Select a lorebook from the left, or create a new one."
            />
          </div>
        ) : (
          <EntryList
            book={bookDetail}
            characters={characters ?? []}
            selectedEntryId={effectiveEntryId}
            onSelectEntry={setSelectedEntryId}
            onNewEntry={createEntry}
            onDeleteEntry={deleteEntry}
            onToggleEntryEnabled={toggleEntryEnabled}
            onBookSettingsUpdate={updateLorebook}
          />
        )}
      </aside>

      {/* RIGHT — entry editor */}
      <section className="flex min-w-0 flex-1 flex-col bg-background">
        {selectedEntry && bookDetail ? (
          <EntryEditor
            key={selectedEntry.id}
            entry={selectedEntry}
            mode={editorMode}
            onModeChange={setEditorMode}
            onPatchCache={patchEntryInCache}
            onDelete={deleteEntry}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="No entry selected"
              description="Select an entry from the middle column, or create a new one to begin editing."
            />
          </div>
        )}
      </section>
    </div>
  )
}

// ============================================================
// Lorebook row (left column)
// ============================================================

function LorebookRow({
  book,
  active,
  onClick,
  onToggleEnabled,
  onDelete,
}: {
  book: LorebookListItemT
  active: boolean
  onClick: () => void
  onToggleEnabled: () => void
  onDelete: () => void
}) {
  const boundIds = parseArr(book.boundCharacters)
  const isGlobal = boundIds.length === 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-1 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors',
        'hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none',
        active && 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'truncate text-sm font-medium',
                !book.enabled && 'text-muted-foreground',
              )}
            >
              {book.name}
            </span>
            {active && (
              <ChevronRight className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{book._count.entries} entries</span>
            <span>·</span>
            {isGlobal ? (
              <span className="inline-flex items-center gap-0.5">
                <Globe className="h-2.5 w-2.5" />
                Global
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <Hash className="h-2.5 w-2.5" />
                {boundIds.length} bound
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={book.enabled}
            onCheckedChange={onToggleEnabled}
            aria-label="Toggle lorebook"
          />
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 bottom-1.5 h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
            title="Delete lorebook"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lorebook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{book.name}</strong> and all{' '}
              {book._count.entries} of its entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Entry list (middle column)
// ============================================================

function EntryList({
  book,
  characters,
  selectedEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onToggleEntryEnabled,
  onBookSettingsUpdate,
}: {
  book: LorebookDetailT
  characters: CharacterT[]
  selectedEntryId: string | null
  onSelectEntry: (id: string) => void
  onNewEntry: () => void
  onDeleteEntry: (id: string) => void
  onToggleEntryEnabled: (id: string, enabled: boolean) => void
  onBookSettingsUpdate: (id: string, patch: Record<string, unknown>) => Promise<LorebookDetailT>
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{book.name}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {book.description || 'No description.'}
            </div>
          </div>
          <LorebookSettingsDialog
            book={book}
            characters={characters}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            onSave={async (patch) => {
              try {
                await onBookSettingsUpdate(book.id, patch)
                toast.success('Lorebook updated')
                setSettingsOpen(false)
              } catch (e) {
                toast.error('Failed to update lorebook', {
                  description: (e as Error).message,
                })
              }
            }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 flex-1 gap-1" onClick={onNewEntry}>
            <Plus className="h-3.5 w-3.5" />
            New Entry
          </Button>
        </div>
      </div>
      <Separator />
      {/* Entry rows */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {book.entries.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="No entries yet"
              description="Add entries with keywords to inject world info into prompts."
              action={
                <Button size="sm" variant="outline" className="mt-2" onClick={onNewEntry}>
                  <Plus className="h-3.5 w-3.5" />
                  New Entry
                </Button>
              }
            />
          ) : (
            book.entries.map((e, i) => (
              <EntryRow
                key={e.id}
                entry={e}
                index={i}
                active={e.id === selectedEntryId}
                onClick={() => onSelectEntry(e.id)}
                onDelete={() => onDeleteEntry(e.id)}
                onToggleEnabled={(checked) => onToggleEntryEnabled(e.id, checked)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  )
}

function EntryRow({
  entry,
  index,
  active,
  onClick,
  onDelete,
  onToggleEnabled,
}: {
  entry: LoreEntryT
  index: number
  active: boolean
  onClick: () => void
  onDelete: () => void
  onToggleEnabled: (checked: boolean) => void
}) {
  const keys = parseArr(entry.keys)
  const title = keys[0]?.trim() || entry.comment?.trim() || 'Untitled entry'
  const subKeys = keys.length > 1 ? `+${keys.length - 1} more` : null
  const contentPreview = entry.content
    ? entry.content.slice(0, 80) + (entry.content.length > 80 ? '…' : '')
    : 'No content'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-1 rounded-lg border border-transparent px-2.5 py-2 transition-colors',
        'hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none',
        active && 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10',
        !entry.enabled && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{title}</span>
          </div>
          {subKeys && (
            <div className="mt-0.5 pl-4 text-[10px] text-muted-foreground">{subKeys}</div>
          )}
          <div className="mt-0.5 line-clamp-1 pl-4 text-[11px] text-muted-foreground">
            {contentPreview}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={entry.enabled}
            onCheckedChange={onToggleEnabled}
            aria-label="Toggle entry"
          />
        </div>
      </div>
      <div className="flex items-center gap-1 pl-7">
        <Badge
          variant="outline"
          className={cn('h-4 px-1.5 text-[10px] font-medium', activationBadgeClass(entry.activation))}
        >
          {ACTIVATION_LABEL[entry.activation] ?? 'Keyword'}
        </Badge>
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-medium text-muted-foreground">
          #{entry.order}
        </Badge>
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-medium text-muted-foreground">
          {POSITION_LABEL[entry.position] ?? 'Before'}
        </Badge>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 bottom-1.5 h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
            title="Delete entry"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the entry “{title}”. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Lorebook settings dialog
// ============================================================

function LorebookSettingsDialog({
  book,
  characters,
  open,
  onOpenChange,
  onSave,
}: {
  book: LorebookDetailT
  characters: CharacterT[]
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (patch: Record<string, unknown>) => Promise<void>
}) {
  const [name, setName] = useState(book.name)
  const [description, setDescription] = useState(book.description ?? '')
  const [tokenBudget, setTokenBudget] = useState(String(book.tokenBudget))
  const [scanDepth, setScanDepth] = useState(String(book.scanDepth))
  const [enabled, setEnabled] = useState(book.enabled)
  const [boundIds, setBoundIds] = useState<string[]>(parseArr(book.boundCharacters))
  const [saving, setSaving] = useState(false)

  // Re-sync when dialog opens (book may have changed elsewhere)
  useEffect(() => {
    if (open) {
      setName(book.name)
      setDescription(book.description ?? '')
      setTokenBudget(String(book.tokenBudget))
      setScanDepth(String(book.scanDepth))
      setEnabled(book.enabled)
      setBoundIds(parseArr(book.boundCharacters))
    }
  }, [open, book])

  const toggleBound = (id: string) => {
    setBoundIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        name: name.trim() || 'Untitled Lorebook',
        description: description.trim() || null,
        tokenBudget: Number(tokenBudget) || 0,
        scanDepth: Number(scanDepth) || 0,
        enabled,
        boundCharacters: boundIds,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1">
          <Settings2 className="h-3.5 w-3.5" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Lorebook settings</DialogTitle>
          <DialogDescription>
            Configure how this lorebook is activated and bounded.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lb-name">Name</Label>
            <Input
              id="lb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lorebook name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lb-desc">Description</Label>
            <Textarea
              id="lb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this lorebook for?"
              className="min-h-[60px] resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lb-tb">Token Budget</Label>
              <Input
                id="lb-tb"
                type="number"
                value={tokenBudget}
                onChange={(e) => setTokenBudget(e.target.value)}
                min={0}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lb-sd">Scan Depth</Label>
              <Input
                id="lb-sd"
                type="number"
                value={scanDepth}
                onChange={(e) => setScanDepth(e.target.value)}
                min={0}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex flex-col">
              <Label htmlFor="lb-enabled" className="text-sm font-medium">
                Enabled
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Disabled lorebooks are never scanned or injected.
              </span>
            </div>
            <Switch id="lb-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <Separator />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Bound Characters</Label>
              {boundIds.length === 0 ? (
                <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300">
                  <Globe className="h-3 w-3" />
                  Global
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Hash className="h-3 w-3" />
                  {boundIds.length} bound
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Empty = global (applies to every character). Otherwise this lorebook only
              activates for the selected characters.
            </p>
            <div className="mt-1 max-h-[180px] overflow-y-auto rounded-lg border">
              {characters.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No characters yet. Create one in the Characters view.
                </div>
              ) : (
                <div className="divide-y">
                  {characters.map((c) => {
                    const checked = boundIds.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent/50',
                          checked && 'bg-emerald-500/5',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleBound(c.id)}
                        />
                        <span className="flex-1 truncate">{c.name}</span>
                        {checked && (
                          <CornerDownRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            {boundIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-fit text-xs text-muted-foreground"
                onClick={() => setBoundIds([])}
              >
                Clear selection (make global)
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Entry editor (right column)
// ============================================================

function EntryEditor({
  entry,
  mode,
  onModeChange,
  onPatchCache,
  onDelete,
}: {
  entry: LoreEntryT
  mode: 'simple' | 'advanced'
  onModeChange: (m: 'simple' | 'advanced') => void
  onPatchCache: (id: string, patch: Partial<LoreEntryT>) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<EntryDraft>(() => entryToDraft(entry))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Refs for auto-save snapshot tracking
  const lastSyncedRef = useRef<string>('')
  const onPatchCacheRef = useRef(onPatchCache)
  useEffect(() => {
    onPatchCacheRef.current = onPatchCache
  }, [onPatchCache])

  // Listen for external patches (e.g. enabled toggle from entry row)
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as {
        id: string
        patch: Partial<LoreEntryT>
      }
      if (detail.id !== entry.id) return
      setDraft((prev) => {
        const next = { ...prev, ...detail.patch }
        lastSyncedRef.current = JSON.stringify(next)
        return next
      })
    }
    window.addEventListener('halcyon:entry-patch', handler)
    return () => window.removeEventListener('halcyon:entry-patch', handler)
  }, [entry.id])

  // Initialize lastSyncedRef on mount / when entry id changes
  // (resets so the first render doesn't trigger a save).
  // draft is intentionally read here without being in deps — we only want
  // this to run on entry switch, not on every keystroke. (exhaustive-deps is
  // disabled project-wide.)
  useEffect(() => {
    lastSyncedRef.current = JSON.stringify(draft)
  }, [entry.id])

  // Auto-save with debounce (600ms) — only when draft actually changes from last synced
  useEffect(() => {
    const snapshot = JSON.stringify(draft)
    if (snapshot === lastSyncedRef.current) return

    const t = setTimeout(async () => {
      setSaving(true)
      try {
        const saved = await api<LoreEntryT>(
          `/api/loreentries/${draft.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(draftToPayload(draft)),
          },
        )
        lastSyncedRef.current = JSON.stringify(draft)
        // Update parent cache so the entry list reflects new values
        onPatchCacheRef.current(draft.id, {
          keys: saved.keys,
          aliases: saved.aliases,
          content: saved.content,
          comment: saved.comment,
          enabled: saved.enabled,
          position: saved.position,
          order: saved.order,
          depth: saved.depth,
          weight: saved.weight,
          activation: saved.activation,
          caseSensitive: saved.caseSensitive,
          wholeWord: saved.wholeWord,
        })
        setSavedAt(Date.now())
      } catch (e) {
        toast.error('Failed to save entry', { description: (e as Error).message })
      } finally {
        setSaving(false)
      }
    }, 600)

    return () => clearTimeout(t)
  }, [draft])

  // Updaters
  const update = useCallback(<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Editor header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {parseArr(draft.keys)[0] || draft.comment || 'Untitled entry'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator saving={saving} savedAt={savedAt} />
          <Tabs
            value={mode}
            onValueChange={(v) => onModeChange(v as 'simple' | 'advanced')}
          >
            <TabsList className="h-7">
              <TabsTrigger value="simple" className="px-2 text-xs">Simple</TabsTrigger>
              <TabsTrigger value="advanced" className="px-2 text-xs">Advanced</TabsTrigger>
            </TabsList>
          </Tabs>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Delete entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the entry. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => onDelete(entry.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Editor body */}
      <ScrollArea className="flex-1">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-4">
          {/* Keys */}
          <Field
            label="Keys"
            hint="Comma-separated keywords that trigger this entry."
            icon={<KeyRound className="h-3.5 w-3.5" />}
          >
            <Input
              value={joinArr(draft.keys)}
              onChange={(e) => update('keys', splitArr(e.target.value))}
              placeholder="e.g. elf, forest, kingdom"
            />
            {draft.keys.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {draft.keys.map((k, i) => (
                  <Badge key={`${k}-${i}`} variant="secondary" className="text-[10px] font-normal">
                    {k}
                  </Badge>
                ))}
              </div>
            )}
          </Field>

          {/* Content */}
          <Field label="Content" hint="The text injected into the prompt when this entry activates.">
            <Textarea
              value={draft.content}
              onChange={(e) => update('content', e.target.value)}
              placeholder="Write the lore entry content here…"
              className="min-h-[160px] resize-y font-mono text-[13px] leading-relaxed"
            />
            <div className="mt-1 flex justify-end text-[10px] text-muted-foreground">
              {draft.content.length} chars · ~{Math.ceil(draft.content.length / 4)} tokens
            </div>
          </Field>

          {/* Activation + Enabled row (always shown) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Activation">
              <Select
                value={String(draft.activation)}
                onValueChange={(v) => update('activation', Number(v) as Activation)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">
                    <span className="flex items-center gap-2">
                      <KeyRound className="h-3.5 w-3.5" />
                      Keyword
                    </span>
                  </SelectItem>
                  <SelectItem value="1">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      Constant
                    </span>
                  </SelectItem>
                  <SelectItem value="2">
                    <span className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5" />
                      Selective
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-end justify-between rounded-lg border px-3 py-2">
              <div className="flex flex-col">
                <Label className="text-sm font-medium">Enabled</Label>
                <span className="text-[10px] text-muted-foreground">Inject when activated</span>
              </div>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(c) => update('enabled', c)}
              />
            </div>
          </div>

          {draft.activation === 1 && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Constant entries are always injected — no keyword matching required.
              </span>
            </div>
          )}

          {/* Advanced fields */}
          {mode === 'advanced' && (
            <>
              <Separator />

              <Field
                label="Aliases"
                hint="Additional keywords that also trigger this entry (treated as keys)."
              >
                <Input
                  value={joinArr(draft.aliases)}
                  onChange={(e) => update('aliases', splitArr(e.target.value))}
                  placeholder="e.g. woodland, sylvan"
                />
              </Field>

              <Field label="Comment" hint="Internal note. Never injected into the prompt.">
                <Input
                  value={draft.comment}
                  onChange={(e) => update('comment', e.target.value)}
                  placeholder="Optional note for yourself…"
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field
                  label="Order"
                  tooltip="Priority. Lower numbers inject first."
                >
                  <Input
                    type="number"
                    value={String(draft.order)}
                    onChange={(e) => update('order', Number(e.target.value) || 0)}
                    min={0}
                  />
                </Field>
                <Field label="Depth">
                  <Input
                    type="number"
                    value={String(draft.depth)}
                    onChange={(e) => update('depth', Number(e.target.value) || 0)}
                    min={0}
                  />
                </Field>
                <Field label="Weight">
                  <Input
                    type="number"
                    value={String(draft.weight)}
                    onChange={(e) => update('weight', Number(e.target.value) || 0)}
                    min={0}
                  />
                </Field>
              </div>

              <Field label="Position" hint="Where in the prompt this entry is inserted.">
                <Select
                  value={String(draft.position)}
                  onValueChange={(v) => update('position', Number(v) as Position)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Before Character</SelectItem>
                    <SelectItem value="1">After Character</SelectItem>
                    <SelectItem value="2">At End</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <div className="flex flex-col">
                    <Label className="text-sm font-medium">Case Sensitive</Label>
                    <span className="text-[10px] text-muted-foreground">Match keyword case</span>
                  </div>
                  <Switch
                    checked={draft.caseSensitive}
                    onCheckedChange={(c) => update('caseSensitive', c)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <div className="flex flex-col">
                    <Label className="text-sm font-medium">Whole Word</Label>
                    <span className="text-[10px] text-muted-foreground">Match word boundaries</span>
                  </div>
                  <Switch
                    checked={draft.wholeWord}
                    onCheckedChange={(c) => update('wholeWord', c)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================
// Small UI helpers
// ============================================================

function Field({
  label,
  hint,
  tooltip,
  icon,
  children,
}: {
  label: string
  hint?: string
  tooltip?: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <Label className="text-sm font-medium">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={(e) => e.preventDefault()}
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SaveIndicator({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  const [, force] = useState(0)
  // Force a re-render every 30s so "saved Xs ago" stays fresh
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (saving) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    )
  }
  if (savedAt) {
    const secs = Math.round((Date.now() - savedAt) / 1000)
    const label = secs < 5 ? 'Saved' : secs < 60 ? `Saved ${secs}s ago` : `Saved ${Math.round(secs / 60)}m ago`
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {label}
      </span>
    )
  }
  return null
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <div className="rounded-full border bg-muted/40 p-2.5 text-muted-foreground">{icon}</div>
      <div className="text-sm font-medium">{title}</div>
      {description && (
        <p className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

// Re-export so unused-variable guards don't trip on type-only helpers
export type { EntryDraft, LoreEntryT, LorebookListItemT, LorebookDetailT }
