import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { buildActiveTimeline, parseJson, parseStringArray } from '@/lib/api-shared'
import { buildContext } from '@/lib/context-builder'
import { streamGenerate } from '@/lib/ai-runtime'
import {
  DEFAULT_GEN_PARAMS,
  DEFAULT_PROMPT_SETTINGS,
  estimateTokens,
  PROVIDERS,
} from '@/lib/providers'
import type { GenParams, PromptSettings, ProviderType } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface GenerateBody {
  chatId: string
  parentId?: string | null
  userInput?: string
  mode: 'send' | 'regenerate' | 'continue'
}

export async function POST(req: NextRequest) {
  let chatId: string | undefined
  let assistantMessageId: string | undefined
  let createdUserId: string | undefined

  try {
    const body = (await req.json().catch(() => ({}))) as GenerateBody
    chatId = body.chatId
    const parentId = body.parentId ?? null
    const userInput = (body.userInput ?? '').toString()
    const mode = body.mode || 'send'

    if (!chatId) {
      return Response.json({ error: 'chatId is required' }, { status: 400 })
    }

    const chat = await db.chat.findUnique({
      where: { id: chatId },
      include: {
        character: true,
        persona: true,
        preset: true,
        apiProfile: true,
      },
    })
    if (!chat) {
      return Response.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Resolve provider config
    const apiProfile =
      chat.apiProfile ||
      (chat.preset?.apiProfileId
        ? await db.apiProfile.findUnique({
            where: { id: chat.preset.apiProfileId },
          })
        : null) ||
      (await db.apiProfile.findFirst({ where: { isDefault: true } })) ||
      (await db.apiProfile.findFirst())

    if (!apiProfile) {
      return Response.json(
        { error: 'No API profile configured' },
        { status: 400 },
      )
    }

    const provider = (apiProfile.provider || 'openai') as ProviderType
    // The API profile is the authoritative source for the model. Presets that
    // happen to carry a hardcoded model (e.g. the seeded "gpt-4o") must not
    // silently override it. Fall back to the provider's default model.
    const providerMeta = PROVIDERS[provider] || PROVIDERS.openai
    const model =
      apiProfile.modelName ||
      providerMeta.defaultModels[0]?.id ||
      chat.preset?.modelName ||
      'gpt-4o'

    const genParams: GenParams = {
      ...DEFAULT_GEN_PARAMS,
      ...parseJson(chat.preset?.genParams || '{}', {}),
    }
    const promptSettings: PromptSettings = {
      ...DEFAULT_PROMPT_SETTINGS,
      ...parseJson(chat.preset?.promptSettings || '{}', {}),
    }

    // Load character lorebooks (enabled AND global or bound to this character)
    const allBooks = await db.lorebook.findMany({
      where: { enabled: true },
    })
    const characterLorebooks = allBooks.filter((b) => {
      const bound = parseStringArray(b.boundCharacters)
      return bound.length === 0 || bound.includes(chat.characterId)
    })

    // Load the active message timeline
    const allMessages = await db.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    })

    // Helper: collect descendant ids of a given message id
    const collectDescendants = (rootId: string): Set<string> => {
      const out = new Set<string>()
      const byParent = new Map<string, typeof allMessages>()
      for (const m of allMessages) {
        if (!m.parentId) continue
        const arr = byParent.get(m.parentId) || []
        arr.push(m)
        byParent.set(m.parentId, arr)
      }
      const queue = [rootId]
      while (queue.length) {
        const cur = queue.shift()!
        const children = byParent.get(cur) || []
        for (const c of children) {
          if (!out.has(c.id)) {
            out.add(c.id)
            queue.push(c.id)
          }
        }
      }
      return out
    }

    // Determine the message history passed to buildContext
    let historyMessages: { role: string; content: string }[] = []
    let effectiveUserInput = userInput
    let assistantParentId: string | null = parentId
    let continueMessageId: string | null = null

    if (mode === 'send') {
      // 1. Create the user message first
      const userMsg = await db.message.create({
        data: {
          chatId,
          role: 'user',
          content: userInput,
          parentId: parentId ?? null,
          isActive: true,
        },
      })
      createdUserId = userMsg.id

      // Deactivate sibling messages under the same parent (if any)
      if (parentId) {
        await db.message.updateMany({
          where: { parentId, id: { not: userMsg.id } },
          data: { isActive: false },
        })
        await db.message.update({
          where: { id: parentId },
          data: { activeChildId: userMsg.id },
        })
      }

      // Rebuild timeline including the new user message
      const fresh = await db.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
      })
      const timeline = buildActiveTimeline(fresh)
      // Exclude the just-created user message from "history" since buildContext
      // appends userInput separately as the last user message.
      historyMessages = timeline
        .filter((m) => m.id !== userMsg.id)
        .map((m) => ({ role: m.role, content: m.content }))
      effectiveUserInput = userInput
      assistantParentId = userMsg.id
    } else if (mode === 'regenerate') {
      // Exclude the message being regenerated (parentId) and its descendants.
      // The "parent" here is the message whose assistant child we are regenerating,
      // so history ends at the parent itself.
      const timeline = buildActiveTimeline(allMessages)
      const excludeIds = parentId ? collectDescendants(parentId) : new Set<string>()
      if (parentId) excludeIds.add(parentId)
      historyMessages = timeline
        .filter((m) => !excludeIds.has(m.id))
        .map((m) => ({ role: m.role, content: m.content }))
      effectiveUserInput = userInput
      assistantParentId = parentId
    } else {
      // mode === 'continue'
      // Find the last active assistant message — we'll append to it.
      const timeline = buildActiveTimeline(allMessages)
      const lastAssistant = [...timeline]
        .reverse()
        .find((m) => m.role === 'assistant')
      if (lastAssistant) {
        continueMessageId = lastAssistant.id
        historyMessages = timeline
          .filter((m) => m.id !== lastAssistant.id)
          .map((m) => ({ role: m.role, content: m.content }))
        // The existing assistant content is the "history" we'll continue from.
        historyMessages.push({
          role: 'assistant',
          content: lastAssistant.content,
        })
      } else {
        historyMessages = timeline.map((m) => ({
          role: m.role,
          content: m.content,
        }))
      }
      effectiveUserInput = ''
    }

    // Build context
    const built = await buildContext({
      character: chat.character,
      persona: chat.persona,
      messages: historyMessages,
      promptSettings,
      genParams,
      chatId,
      characterLorebooks,
      userInput: effectiveUserInput,
    })

    // Create placeholder assistant message (unless continuing)
    if (mode === 'continue' && continueMessageId) {
      assistantMessageId = continueMessageId
    } else {
      const placeholder = await db.message.create({
        data: {
          chatId,
          role: 'assistant',
          content: '',
          parentId: assistantParentId,
          isActive: true,
          model,
          provider,
          swipes: '[]',
        },
      })
      assistantMessageId = placeholder.id
      // Deactivate siblings under the same parent
      if (assistantParentId) {
        await db.message.updateMany({
          where: {
            parentId: assistantParentId,
            id: { not: placeholder.id },
          },
          data: { isActive: false },
        })
        await db.message.update({
          where: { id: assistantParentId },
          data: { activeChildId: placeholder.id },
        })
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        const send = (obj: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
            )
          } catch {
            // controller may be closed
          }
        }

        let full = ''
        let done = false
        const start = Date.now()

        const persist = async (content: string, meta: {
          tokens: number
          model?: string
          provider: ProviderType
          latencyMs: number
        }) => {
          if (!assistantMessageId) return
          try {
            // Update message content + metadata
            const existing = await db.message.findUnique({
              where: { id: assistantMessageId },
            })
            const swipes = existing ? parseStringArray(existing.swipes) : []
            // For 'continue' we replace existing content; otherwise we also append a swipe.
            if (mode === 'continue') {
              // Replace last swipe if present, else push
              if (swipes.length === 0) {
                swipes.push(content)
              } else {
                swipes[swipes.length - 1] = content
              }
            } else {
              // Fresh assistant message — first swipe
              if (swipes.length === 0) {
                swipes.push(content)
              } else {
                swipes[swipes.length - 1] = content
              }
            }
            await db.message.update({
              where: { id: assistantMessageId },
              data: {
                content,
                tokens: meta.tokens,
                latencyMs: meta.latencyMs,
                model: meta.model,
                provider: meta.provider,
                swipes: JSON.stringify(swipes),
                swipeIndex: Math.max(0, swipes.length - 1),
              },
            })
          } catch (e) {
            // best-effort
            void e
          }
        }

        streamGenerate(
          {
            provider,
            baseUrl: apiProfile.baseUrl ?? undefined,
            apiKey: apiProfile.apiKey ?? undefined,
            model,
            messages: built.messages,
            params: genParams,
            // NOTE: we intentionally do NOT pass req.signal here. Next.js may
            // abort req.signal when the response stream is returned, which would
            // cut generation short and leave the assistant message empty. The
            // generation runs to completion and persists; the client "Stop"
            // button simply stops rendering tokens client-side.
            signal: undefined,
          },
          {
            onToken: (token) => {
              if (done) return
              full += token
              send({ type: 'token', token })
            },
            onDone: async (fullContent, meta) => {
              if (done) return
              done = true
              full = fullContent
              await persist(full, meta)
              send({
                type: 'done',
                messageId: assistantMessageId,
                content: full,
                meta,
              })
              try {
                controller.close()
              } catch {
                /* noop */
              }
            },
            onError: async (err) => {
              if (done) return
              done = true
              // Persist whatever was generated
              if (full) {
                await persist(full, {
                  tokens: estimateTokens(full),
                  model,
                  provider,
                  latencyMs: Date.now() - start,
                })
              }
              send({ type: 'error', error: err.message })
              try {
                controller.close()
              } catch {
                /* noop */
              }
            },
          },
        ).catch(async (err) => {
          if (done) return
          done = true
          if (full) {
            await persist(full, {
              tokens: estimateTokens(full),
              model,
              provider,
              latencyMs: Date.now() - start,
            })
          }
          send({ type: 'error', error: (err as Error).message })
          try {
            controller.close()
          } catch {
            /* noop */
          }
        })
      },
      cancel() {
        // Client disconnected — request.signal.aborted will be true.
        // streamGenerate already polls `signal?.aborted` and will persist on done.
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    // If we already created a user message but failed before streaming,
    // surface the error to the client.
    void chatId
    void createdUserId
    return Response.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
