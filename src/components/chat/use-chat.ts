'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, useFetch } from '@/hooks/use-fetch'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

export interface ChatMessage {
  id: string
  chatId: string
  role: string
  content: string
  parentId: string | null
  activeChildId: string | null
  isActive: boolean
  model?: string | null
  provider?: string | null
  tokens?: number | null
  latencyMs?: number | null
  branchLabel?: string | null
  isPinned: boolean
  isImportant: boolean
  swipes: string[]
  swipeIndex: number
  createdAt: string
  updatedAt: string
}

export function useChat(chatId: string | null) {
  const { data: chat, reload: reloadChat } = useFetch<any>(chatId ? `/api/chats/${chatId}` : null, [chatId])
  const { data: messages, reload: reloadMessages } = useFetch<ChatMessage[]>(
    chatId ? `/api/chats/${chatId}/messages` : null,
    [chatId],
  )
  const [streaming, setStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const setGenerating = useAppStore((s) => s.setGenerating)

  const generate = useCallback(
    async (
      mode: 'send' | 'regenerate' | 'continue',
      payload: { userInput?: string; parentId?: string },
    ) => {
      if (!chatId) return
      setStreaming(true)
      setGenerating(true)
      setStreamingContent('')
      const ctrl = new AbortController()
      abortRef.current = ctrl

      // Optimistic: for 'send', show the user message immediately
      let optimisticUser: ChatMessage | null = null
      if (mode === 'send' && payload.userInput) {
        optimisticUser = {
          id: `opt-${Date.now()}`,
          chatId,
          role: 'user',
          content: payload.userInput,
          parentId: payload.parentId || null,
          activeChildId: null,
          isActive: true,
          isPinned: false,
          isImportant: false,
          swipes: [],
          swipeIndex: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            mode,
            userInput: payload.userInput || '',
            parentId: payload.parentId,
          }),
          signal: ctrl.signal,
        })

        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => '')
          throw new Error(txt || `HTTP ${res.status}`)
        }

        // We need a placeholder assistant streaming id. We'll set it when the
        // first 'done' arrives, but for streaming we update content live and
        // create the message shell from the first token.
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantId: string | null = null
        let fullContent = ''

        // Optimistic update of messages list
        if (optimisticUser) {
          // We rely on reload after done; for live UX append optimistic user
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const data = line.startsWith('data: ') ? line.slice(6) : ''
            if (!data) continue
            try {
              const evt = JSON.parse(data)
              if (evt.type === 'token') {
                if (!assistantId) {
                  assistantId = `stream-${Date.now()}`
                  setStreamingId(assistantId)
                }
                fullContent += evt.token
                setStreamingContent(fullContent)
              } else if (evt.type === 'done') {
                setStreamingId(null)
                setStreamingContent('')
                await reloadMessages()
                await reloadChat()
                if (evt.meta) {
                  // optionally surface latency
                }
              } else if (evt.type === 'error') {
                throw new Error(evt.error || 'Generation failed')
              }
            } catch {
              // ignore parse errors
            }
          }
        }
        if (optimisticUser) await reloadMessages()
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          toast.error((e as Error).message)
        }
      } finally {
        setStreaming(false)
        setGenerating(false)
        setStreamingId(null)
        setStreamingContent('')
        abortRef.current = null
      }
    },
    [chatId, reloadMessages, reloadChat, setGenerating],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    chat,
    messages: messages || [],
    loading: !messages && !!chatId,
    generate,
    stop,
    streaming,
    streamingId,
    streamingContent,
    reloadMessages,
    reloadChat,
  }
}
