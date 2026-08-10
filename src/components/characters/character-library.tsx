'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useFetch, api } from '@/hooks/use-fetch'
import { Avatar } from '@/components/shared/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, Plus, Star, MoreVertical, MessageSquare, Copy, Download, Upload,
  Pencil, Trash2, Tag, Users, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

function parseTags(s: any): string[] {
  if (!s) return []
  if (Array.isArray(s)) return s
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

export function CharacterLibrary() {
  const setEditingCharacter = useAppStore((s) => s.setEditingCharacter)
  const setActiveCharacter = useAppStore((s) => s.setActiveCharacter)
  const setActiveChat = useAppStore((s) => s.setActiveChat)
  const setView = useAppStore((s) => s.setView)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('favorite')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const { data: characters, reload } = useFetch<any[]>(
    `/api/characters?sort=${sort}&search=${encodeURIComponent(search)}`,
    [sort, search, tick],
  )

  useEffect(() => {
    const handler = () => reload()
    window.addEventListener('halcyon:seeded', handler)
    return () => window.removeEventListener('halcyon:seeded', handler)
  }, [reload])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    characters?.forEach((c) => parseTags(c.tags).forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [characters])

  const filtered = useMemo(() => {
    if (!characters) return []
    if (tagFilter === 'all') return characters
    if (tagFilter === 'favorites') return characters.filter((c) => c.favorite)
    return characters.filter((c) => parseTags(c.tags).includes(tagFilter))
  }, [characters, tagFilter])

  const startChat = async (characterId: string, name: string) => {
    try {
      const chat = await api('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ title: name, characterId }),
      })
      setActiveCharacter(characterId)
      setActiveChat(chat.id)
      setView('chat')
      toast.success(`Chatting with ${name}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const toggleFavorite = async (c: any) => {
    try {
      await api(`/api/characters/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ favorite: !c.favorite }),
      })
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const duplicate = async (c: any) => {
    try {
      await api(`/api/characters/${c.id}/duplicate`, { method: 'POST' })
      toast.success('Character duplicated')
      setTick((t) => t + 1)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const exportChar = async (c: any) => {
    window.open(`/api/characters/${c.id}/export`, '_blank')
    toast.success(`Exporting ${c.name}.json`)
  }

  const importCard = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const card = JSON.parse(text)
        await api('/api/characters/import', {
          method: 'POST',
          body: JSON.stringify(card),
        })
        toast.success('Character imported')
        setTick((t) => t + 1)
      } catch (e) {
        toast.error(`Import failed: ${(e as Error).message}`)
      }
    }
    input.click()
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/characters/${deleteId}`, { method: 'DELETE' })
      toast.success('Character deleted')
      setDeleteId(null)
      setTick((t) => t + 1)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Characters</h1>
            <p className="text-sm text-muted-foreground">
              Your local character library. {filtered.length} character{filtered.length !== 1 ? 's' : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input type="file" id="import-input" accept=".json" className="hidden" onChange={importCard} />
            <Button variant="outline" size="sm" className="gap-2" onClick={importCard}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setEditingCharacter('new')}>
              <Plus className="h-4 w-4" />
              New Character
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search characters..."
              className="h-9 pl-8"
            />
          </div>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              <SelectItem value="favorites">Favorites</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="favorite">Favorites first</SelectItem>
              <SelectItem value="recent">Recently updated</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No characters found</p>
                <p className="text-sm text-muted-foreground">
                  {search || tagFilter !== 'all'
                    ? 'Try adjusting your search or filters.'
                    : 'Create your first character to get started.'}
                </p>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setEditingCharacter('new')}>
                <Plus className="h-4 w-4" />
                New Character
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((c) => {
                const tags = parseTags(c.tags)
                return (
                  <Card
                    key={c.id}
                    className="group relative flex flex-col gap-3 p-3 transition-all hover:shadow-md hover:border-primary/40"
                  >
                    {/* Top row: avatar + name + menu */}
                    <div className="flex items-start gap-3">
                      <button onClick={() => startChat(c.id, c.name)} className="shrink-0">
                        <Avatar name={c.name} src={c.avatar} size="lg" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => startChat(c.id, c.name)}
                            className="truncate text-left font-medium leading-tight hover:text-primary"
                          >
                            {c.name}
                          </button>
                          {c.favorite && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
                          )}
                        </div>
                        {c.creator && (
                          <p className="truncate text-xs text-muted-foreground">by {c.creator}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                              {t}
                            </Badge>
                          ))}
                          {tags.length > 3 && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                              +{tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => startChat(c.id, c.name)}>
                            <MessageSquare className="mr-2 h-4 w-4" /> Chat
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingCharacter(c.id)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleFavorite(c)}>
                            <Star className="mr-2 h-4 w-4" /> {c.favorite ? 'Unfavorite' : 'Favorite'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(c)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportChar(c)}>
                            <Download className="mr-2 h-4 w-4" /> Export
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(c.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Description */}
                    <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
                      {c.description || 'No description.'}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-[11px] text-muted-foreground">
                        {c._count?.chats ? `${c._count.chats} chat${c._count.chats !== 1 ? 's' : ''}` : 'No chats'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => startChat(c.id, c.name)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Chat
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this character?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the character and all of its conversations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
