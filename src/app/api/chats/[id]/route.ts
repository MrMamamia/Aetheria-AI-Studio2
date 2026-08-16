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

    // Resolve the EFFECTIVE api profile for display. If the chat has no
    // apiProfileId linked (or the linked profile was deleted), fall back to
    // the preset's profile, then the default profile, then any profile.
    // This ensures the chat header always shows the model that will actually
    // be used for generation, rather than a stale "gpt-4o" fallback.
    let effectiveProfile = chat.apiProfile
    if (!effectiveProfile) {
      if (chat.preset?.apiProfileId) {
        effectiveProfile = await db.apiProfile.findUnique({
          where: { id: chat.preset.apiProfileId },
        })
      }
      if (!effectiveProfile) {
        effectiveProfile =
          (await db.apiProfile.findFirst({ where: { isDefault: true } })) ||
          (await db.apiProfile.findFirst())
      }
      if (effectiveProfile) {
        // Persist the resolved profile back onto the chat so future loads
        // are consistent and the client sees the right model immediately.
        await db.chat.update({
          where: { id: chat.id },
          data: { apiProfileId: effectiveProfile.id },
        })
      }
    }

    // Strip apiKey from the embedded apiProfile
    if (effectiveProfile) {
      const { apiKey: _k, ...safe } = effectiveProfile
      void _k
      return NextResponse.json({ ...chat, apiProfile: safe })
    }
    return NextResponse.json({ ...chat, apiProfile: null })
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
