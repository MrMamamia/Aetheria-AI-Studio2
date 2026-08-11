import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const characterId = searchParams.get('characterId') || undefined

    const chats = await db.chat.findMany({
      where: characterId ? { characterId } : undefined,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: {
        character: { select: { id: true, name: true, avatar: true } },
        persona: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    })
    return NextResponse.json(chats)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const characterId = body.characterId
    if (!characterId) {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 })
    }

    const character = await db.character.findUnique({ where: { id: characterId } })
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    // Resolve defaults if not provided
    let personaId = body.personaId ?? null
    let presetId = body.presetId ?? null
    let apiProfileId = body.apiProfileId ?? null

    if (!personaId) {
      const defaultPersona = await db.persona.findFirst({
        where: { isDefault: true },
      })
      personaId = defaultPersona?.id ?? null
    }
    if (!presetId) {
      const defaultPreset = await db.preset.findFirst({
        where: { isDefault: true },
      })
      presetId = defaultPreset?.id ?? null
    }
    if (!apiProfileId) {
      const defaultProfile = await db.apiProfile.findFirst({
        where: { isDefault: true },
      })
      apiProfileId = defaultProfile?.id ?? null
    }

    const title = body.title?.trim() || character.name

    const chat = await db.chat.create({
      data: {
        title,
        characterId,
        personaId,
        presetId,
        apiProfileId,
      },
      include: { messages: true },
    })

    // Auto-create the first assistant message from character.firstMessage
    if (character.firstMessage) {
      await db.message.create({
        data: {
          chatId: chat.id,
          role: 'assistant',
          content: character.firstMessage,
          parentId: null,
          isActive: true,
        },
      })
    }

    const refreshed = await db.chat.findUnique({
      where: { id: chat.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        character: true,
        persona: true,
        preset: true,
        apiProfile: true,
      },
    })

    return NextResponse.json(refreshed, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
