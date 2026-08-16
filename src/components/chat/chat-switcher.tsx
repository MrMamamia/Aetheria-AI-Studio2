'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useFetch, api } from '@/hooks/use-fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/shared/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, MessageSquare, ChevronDown, Search, MoreVertical, Pencil, Copy, Trash2, Pin, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ChatSwitcherProps {
  characterId: string
  activeChatId: string | null
}

export function ChatSwitcher({ characterId, activeChatId }: ChatSwitcherProps) {
  const setActiveChat = useAppStore((s) => s.setActiveChat)
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const { data: characters } = useFetch<any[]>('/api/characters', [tick])
  const character = characters?.find((c) => c.id === characterId)
  const { data: allChats, reload } = useFetch<any[]>('/api/chats', [tick])
  const chats = (allChats || []).filter((c) => c.characterId === characterId)
  const filtered = search ? chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())) : chats
  const activeChat = chats.find((c) => c.id === activeChatId)

  const newChat = async () => {
    try {
      const ch = await api('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ title: character?.name || 'New Chat', characterId }),
      })
      setActiveChat(ch.id)
      setTick((t) => t + 1)
      toast.success('New chat created')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const doRename = async (id: string) => {
    try {
      await api(`/api/chats/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: renameValue }),
      })
      setRenaming(null)
      setTick((t) => t + 1)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const duplicate = async (id: string) => {
    try {
      const src = await api<any>(`/api/chats/${id}`)
      const ch = await api('/api/chats', {
        method: 'POST',
        body: JSON.stringify({
          title: src.title + ' (Copy)',
          characterId,
          personaId: src.personaId,
          presetId: src.presetId,
          apiProfileId: src.apiProfileId,
        }),
      })
      setActiveChat(ch.id)
      setTick((t) => t + 1)
      toast.success('Chat duplicated')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const exportChat = async (id: string) => {
    try {
      const chat = await api<any>(`/api/chats/${id}`)
      const data = JSON.stringify(chat, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${id.slice(0, 8)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Chat exported')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const importChat = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const chat = JSON.parse(text)
        const created = await api('/api/chats', {
          method: 'POST',
          body: JSON.stringify({
            title: chat.title || 'Imported Chat',
            characterId,
            personaId: chat.personaId,
            presetId: chat.presetId,
            apiProfileId: chat.apiProfileId,
          }),
        })
        setActiveChat(created.id)
        setTick((t) => t + 1)
        toast.success('Chat imported')
      } catch (e) {
        toast.error(`Import failed: ${(e as Error).message}`)
      }
    }
    input.click()
  }

  const togglePin = async (id: string, pinned: boolean) => {
    try {
      await api(`/api/chats/${id}`, { method: 'PUT', body: JSON.stringify({ pinned: !pinned }) })
      setTick((t) => t + 1)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/chats/${deleteId}`, { method: 'DELETE' })
      setDeleteId(null)
      if (deleteId === activeChatId) setActiveChat(null)
      setTick((t) => t + 1)
      toast.success('Chat deleted')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-1.5 px-2 font-normal">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="max-w-[180px] truncate">{activeChat?.title || 'Select chat'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats..."
                  className="h-8 pl-8 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-72 scrollbar-thin">
              <div className="flex flex-col">
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">No chats found</div>
                )}
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'group flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent',
                      c.id === activeChatId && 'bg-accent',
                    )}
                  >
                    {c.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                    {renaming === c.id ? (
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => doRename(c.id)}
                        onKeyDown={(e) => e.key === 'Enter' && doRename(c.id)}
                        className="h-7 flex-1 text-sm"
                        autoFocus
                      />
                    ) : (
                      <button
                        className="flex-1 truncate text-left"
                        onClick={() => { setActiveChat(c.id); (document.activeElement as HTMLElement)?.blur() }}
                      >
                        {c.title}
                      </button>
                    )}
                    <div className="flex items-center opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePin(c.id, c.pinned)}>
                        <Pin className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setRenaming(c.id); setRenameValue(c.title) }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => duplicate(c.id)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => exportChat(c.id)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={importChat}>
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={newChat}>
              <Plus className="mr-2 h-4 w-4" /> New chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={importChat}>
              <Upload className="mr-2 h-4 w-4" /> Import chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the chat and all its messages. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
