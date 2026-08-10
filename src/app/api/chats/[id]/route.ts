import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const chat = await db.chat.findUnique({
      where: { id },
      include: {
        character: true,
        persona: true,
        preset: true,
        apiProfile: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    // Strip apiKey from any embedded apiProfile
    if (chat.apiProfile) {
      const { apiKey: _k, ...safe } = chat.apiProfile
      void _k
      return NextResponse.json({ ...chat, apiProfile: safe })
    }
    return NextResponse.json(chat)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const data: Prisma.ChatUpdateInput = {}
    if (body.title !== undefined) data.title = body.title
    if (body.pinned !== undefined) data.pinned = Boolean(body.pinned)
    if (body.personaId !== undefined) {
      data.persona = body.personaId
        ? { connect: { id: body.personaId } }
        : { disconnect: true }
    }
    if (body.presetId !== undefined) {
      data.preset = body.presetId
        ? { connect: { id: body.presetId } }
        : { disconnect: true }
    }
    if (body.apiProfileId !== undefined) {
      data.apiProfile = body.apiProfileId
        ? { connect: { id: body.apiProfileId } }
        : { disconnect: true }
    }

    const updated = await db.chat.update({ where: { id }, data })
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
    await db.chat.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
