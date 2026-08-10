import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildActiveTimeline, parseJson, parseStringArray } from '@/lib/api-shared'
import { buildContext } from '@/lib/context-builder'
import {
  DEFAULT_GEN_PARAMS,
  DEFAULT_PROMPT_SETTINGS,
} from '@/lib/providers'
import type { GenParams, PromptSettings } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { chatId, userInput } = body
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
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
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const genParams: GenParams = {
      ...DEFAULT_GEN_PARAMS,
      ...parseJson(chat.preset?.genParams || '{}', {}),
    }
    const promptSettings: PromptSettings = {
      ...DEFAULT_PROMPT_SETTINGS,
      ...parseJson(chat.preset?.promptSettings || '{}', {}),
    }

    const allBooks = await db.lorebook.findMany({ where: { enabled: true } })
    const characterLorebooks = allBooks.filter((b) => {
      const bound = parseStringArray(b.boundCharacters)
      return bound.length === 0 || bound.includes(chat.characterId)
    })

    const allMessages = await db.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    })
    const timeline = buildActiveTimeline(allMessages).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const built = await buildContext({
      character: chat.character,
      persona: chat.persona,
      messages: timeline,
      promptSettings,
      genParams,
      chatId,
      characterLorebooks,
      userInput: (userInput ?? '').toString(),
    })

    return NextResponse.json(built)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
