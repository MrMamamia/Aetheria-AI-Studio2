'use client'

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from '@/components/ui/command'
import { useAppStore } from '@/lib/store'
import { NAV_GROUPS } from '@/lib/nav'
import { useFetch, api } from '@/hooks/use-fetch'
import { toast } from 'sonner'
import {
  MessageSquarePlus, UserPlus, BookPlus, SlidersHorizontal, KeyRound,
  Sparkles, Focus, CornerDownRight, Star, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen)
  const setOpen = useAppStore((s) => s.setCommandOpen)
  const setView = useAppStore((s) => s.setView)
  const toggleFocus = useAppStore((s) => s.toggleFocus)
  const setEditingCharacter = useAppStore((s) => s.setEditingCharacter)

  const { data: characters } = useFetch<any[]>('/api/characters?sort=favorite', [open])

  const run = async (fn: () => Promise<any> | void, msg: string) => {
    setOpen(false)
    try {
      await fn()
      if (msg) toast.success(msg)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands and characters..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => run(() => {
              setView('characters')
              setEditingCharacter('new')
            }, '')}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            New Character
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => run(async () => {
              const ch = await api('/api/chats', {
                method: 'POST',
                body: JSON.stringify({ title: 'New Chat', characterId: characters?.[0]?.id }),
              })
              setView('chat')
              useAppStore.getState().setActiveChat(ch.id)
              useAppStore.getState().setActiveCharacter(characters?.[0]?.id)
            }, 'Started a new chat')}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New Chat
          </CommandItem>
          <CommandItem onSelect={() => run(() => { setView('personas') }, '')}>
            <Sparkles className="mr-2 h-4 w-4" />
            New Persona
          </CommandItem>
          <CommandItem onSelect={() => run(() => { setView('lorebooks') }, '')}>
            <BookPlus className="mr-2 h-4 w-4" />
            New Lorebook
          </CommandItem>
          <CommandItem onSelect={() => run(() => { setView('presets') }, '')}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Manage Presets
          </CommandItem>
          <CommandItem onSelect={() => run(() => { setView('api') }, '')}>
            <KeyRound className="mr-2 h-4 w-4" />
            Open API Manager
          </CommandItem>
          <CommandItem onSelect={() => run(() => toggleFocus(), '')}>
            <Focus className="mr-2 h-4 w-4" />
            Toggle Focus Mode
            <CommandShortcut>⌘.</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {NAV_GROUPS.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                onSelect={() => run(() => setView(item.id), '')}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            )
          })}
        </CommandGroup>

        {characters && characters.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Characters">
              {characters.slice(0, 12).map((c: any) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => run(async () => {
                    const ch = await api('/api/chats', {
                      method: 'POST',
                      body: JSON.stringify({ title: c.name, characterId: c.id }),
                    })
                    setView('chat')
                    useAppStore.getState().setActiveChat(ch.id)
                    useAppStore.getState().setActiveCharacter(c.id)
                  }, `Opened chat with ${c.name}`)}
                >
                  {c.favorite ? (
                    <Star className="mr-2 h-4 w-4 text-primary" />
                  ) : (
                    <CornerDownRight className="mr-2 h-4 w-4" />
                  )}
                  Chat with {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
