import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { estimateTokens } from '@/lib/providers'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const data: Prisma.MemoryUpdateInput = {}
    if (body.chatId !== undefined) data.chatId = body.chatId || null
    if (body.characterId !== undefined) data.characterId = body.characterId || null
    if (body.type !== undefined) data.type = body.type
    if (body.content !== undefined) {
      data.content = body.content
      data.tokens = estimateTokens(body.content || '')
    }
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)

    const updated = await db.memory.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    await db.memory.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
