import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { estimateTokens } from '@/lib/providers'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const chatId = searchParams.get('chatId') || undefined
    const characterId = searchParams.get('characterId') || undefined

    const where: Prisma.MemoryWhereInput = {}
    if (chatId) where.chatId = chatId
    if (characterId) where.characterId = characterId

    const memories = await db.memory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(memories)
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
    const content = body.content ?? ''
    const data: Prisma.MemoryCreateInput = {
      chatId: body.chatId ?? null,
      characterId: body.characterId ?? null,
      type: body.type || 'manual',
      content,
      tokens: estimateTokens(content),
      enabled: body.enabled !== false,
    }
    const created = await db.memory.create({ data })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
