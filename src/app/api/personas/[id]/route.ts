import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const data: Prisma.PersonaUpdateInput = {}
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description
    if (body.personality !== undefined) data.personality = body.personality
    if (body.background !== undefined) data.background = body.background
    if (body.appearance !== undefined) data.appearance = body.appearance
    if (body.behavior !== undefined) data.behavior = body.behavior
    if (body.speakingStyle !== undefined) data.speakingStyle = body.speakingStyle
    if (body.customInstructions !== undefined) data.customInstructions = body.customInstructions
    if (body.isDefault !== undefined) data.isDefault = Boolean(body.isDefault)

    const updated = await db.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.persona.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        })
      }
      return tx.persona.update({ where: { id }, data })
    })

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
    await db.persona.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
