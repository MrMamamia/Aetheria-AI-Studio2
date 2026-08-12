'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useFetch, api } from '@/hooks/use-fetch'
import { useChat } from './use-chat'
import { MessageItem } from './message-item'
import { Composer } from './composer'
import { ChatSwitcher } from './chat-switcher'
import { Avatar } from '@/components/shared/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users, MessageSquare, ArrowLeft, Square, Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROVIDERS } from '@/lib/providers'

export function ChatView() {
  const activeChatId = useAppStore((s) => s.activeChatId)
  const activeCharacterId = useAppStore((s) => s.activeCharacterId)
  const setActiveChat = useAppStore((s) => s.setActiveChat)
  const setActiveCharacter = useAppStore((s) => s.setActiveCharacter)
  const setView = useAppStore((s) => s.setView)
  const setEditingCharacter = useAppStore((s) => s.setEditingCharacter)
  // Load settings (derived directly to avoid setState-in-effect)
  const { data: settings } = useFetch<any>('/api/settings')
  const sendMode: 'enter' | 'ctrl-enter' =
    settings?.sendMode === 'ctrl-enter' ? 'ctrl-enter' : 'enter'
  const showTokenCounts =
    settings?.showTokenCounts === 'true' || settings?.showTokenCounts === true

  const { chat, messages, loading, generate, stop, streaming, streamingId, streamingContent, reloadMessages } = useChat(activeChatId)

  const character = chat?.character
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const handleSend = (text: string) => {
    autoScrollRef.current = true
    const parentId = messages.length ? messages[messages.length - 1].id : undefined
    generate('send', { userInput: text, parentId })
  }

  const handleRegenerate = (msg: any) => {
    autoScrollRef.current = true
    generate('regenerate', { parentId: msg.parentId })
  }

  const handleContinue = () => {
    autoScrollRef.current = true
    generate('continue', {})
  }

  const handleBranch = async (msg: any) => {
    try {
      const branch = await api(`/api/messages/${msg.id}/branch`, {
        method: 'POST',
        body: JSON.stringify({ content: msg.content + '\n\n*…(branched)*' }),
      })
      toast.success('Branched from this message')
      await reloadMessages()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // No active chat → picker
  if (!activeChatId) {
    return <ChatPicker />
  }

  if (loading || !chat) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading chat…
      </div>
    )
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveChat(null); setView('characters') }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <button onClick={() => setEditingCharacter(character?.id)} className="flex items-center gap-2.5">
          <Avatar name={character?.name || 'AI'} src={character?.avatar} size="md" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button onClick={() => setEditingCharacter(character?.id)} className="truncate font-medium hover:text-primary">
              {character?.name}
            </button>
            {chat.preset && <Badge variant="outline" className="text-[10px]">{chat.preset.name}</Badge>}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {streaming ? (
              <span className="flex items-center gap-1 text-primary">
                <Radio className="h-3 w-3 animate-pulse" /> Generating…
              </span>
            ) : (
              <span>
                {chat.apiProfile?.modelName ||
                  PROVIDERS[
                    (chat.apiProfile?.provider ?? 'openai')
                  ]?.defaultModels?.[0]?.id ||
                  'No model configured'}
              </span>
            )}
          </div>
        </div>

        {character && (
          <ChatSwitcher characterId={character.id} activeChatId={activeChatId} />
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl py-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Avatar name={character?.name || 'AI'} src={character?.avatar} size="xl" />
              <div>
                <p className="font-medium">Start chatting with {character?.name}</p>
                <p className="text-sm text-muted-foreground">Send a message to begin the conversation.</p>
              </div>
            </div>
          )}
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1
            const isStreamingThis = streaming && isLast && m.role === 'assistant'
            return (
              <MessageItem
                key={m.id + '-' + i}
                message={m}
                character={character}
                isStreaming={isStreamingThis}
                streamingContent={isStreamingThis ? streamingContent : undefined}
                streamingReasoning={isStreamingThis ? streamingReasoning : undefined}
                onRegenerate={() => handleRegenerate(m)}
                onContinue={handleContinue}
                onBranch={() => handleBranch(m)}
                onChanged={reloadMessages}
                isLast={isLast && m.role === 'assistant' && !streaming}
                showTokenCounts={showTokenCounts}
              />
            )
          })}
          {/* Streaming message shell when no assistant placeholder yet */}
          {streaming && !streamingId && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
            <div className="flex gap-3 px-4 py-3">
              <Avatar name={character?.name || 'AI'} src={character?.avatar} size="md" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium">{character?.name}</span>
                {streamingReasoning && (
                  <div className="mb-1 max-w-md rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <div className="mb-0.5 font-medium opacity-70">Thinking…</div>
                    <div className="whitespace-pre-wrap break-words opacity-80">{streamingReasoning.slice(-400)}</div>
                  </div>
                )}
                <div className="rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 text-sm">
                  <span className="stream-caret text-muted-foreground">
                    {streamingReasoning ? 'Composing response…' : 'Thinking'}
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Streaming shell when id exists but message not yet in list */}
          {streaming && streamingId && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 px-4 py-3">
              <Avatar name={character?.name || 'AI'} src={character?.avatar} size="md" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium">{character?.name}</span>
                {streamingReasoning && (
                  <div className="mb-1 max-w-md rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <div className="mb-0.5 font-medium opacity-70">Thinking…</div>
                    <div className="whitespace-pre-wrap break-words opacity-80">{streamingReasoning.slice(-400)}</div>
                  </div>
                )}
                <div className="stream-caret rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 text-sm">
                  {streamingContent ? (
                    <MarkdownLite content={streamingContent} />
                  ) : (
                    <span className="text-muted-foreground">
                      {streamingReasoning ? 'Composing response…' : 'Thinking'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <Composer
        onSend={handleSend}
        onStop={stop}
        streaming={streaming}
        sendMode={sendMode}
        placeholder={`Message ${character?.name || 'the character'}…`}
      />
    </div>
  )
}

import { Markdown } from '@/components/shared/markdown'
import { toast } from 'sonner'

function MarkdownLite({ content }: { content: string }) {
  if (!content) return <span className="text-muted-foreground">…</span>
  return <Markdown content={content} />
}

// ---- Chat picker (when no active chat) ----
function ChatPicker() {
  const setActiveChat = useAppStore((s) => s.setActiveChat)
  const setActiveCharacter = useAppStore((s) => s.setActiveCharacter)
  const [tick, setTick] = useState(0)
  const { data: characters } = useFetch<any[]>('/api/characters?sort=favorite', [tick])
  const { data: chats } = useFetch<any[]>('/api/chats', [tick])

  const startChat = async (c: any) => {
    try {
      const chat = await api('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ title: c.name, characterId: c.id }),
      })
      setActiveCharacter(c.id)
      setActiveChat(chat.id)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const resumeChat = async (chatId: string, characterId: string) => {
    setActiveCharacter(characterId)
    setActiveChat(chatId)
  }

  const recentChats = useMemo(() => {
    if (!chats || !characters) return []
    return chats
      .filter((c) => characters.some((ch) => ch.id === c.characterId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8)
      .map((c) => ({ ...c, character: characters.find((ch) => ch.id === c.characterId) }))
  }, [chats, characters])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground">Pick a character to start a conversation, or resume a recent chat.</p>
        </div>

        {recentChats.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent conversations</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recentChats.map((c) => (
                <Card
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent"
                  onClick={() => resumeChat(c.id, c.characterId)}
                >
                  <Avatar name={c.character.name} src={c.character.avatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.character.name}</p>
                  </div>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Start a new chat</h2>
          {characters && characters.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((c) => (
                <Card
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent"
                  onClick={() => startChat(c)}
                >
                  <Avatar name={c.name} src={c.avatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.description?.slice(0, 60) || 'No description'}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No characters yet</p>
                <p className="text-sm text-muted-foreground">Create a character to start chatting.</p>
              </div>
              <Button size="sm" onClick={() => useAppStore.getState().setEditingCharacter('new')}>Create character</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
