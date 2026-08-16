import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJson } from '@/lib/api-shared'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const data: Prisma.LoreEntryUpdateInput = {}
    if (body.keys !== undefined) data.keys = stringifyJson(body.keys)
    if (body.aliases !== undefined) data.aliases = stringifyJson(body.aliases)
    if (body.content !== undefined) data.content = body.content
    if (body.comment !== undefined) data.comment = body.comment
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)
    if (body.position !== undefined) data.position = Number(body.position)
    if (body.order !== undefined) data.order = Number(body.order)
    if (body.depth !== undefined) data.depth = Number(body.depth)
    if (body.weight !== undefined) data.weight = Number(body.weight)
    if (body.activation !== undefined) data.activation = Number(body.activation)
    if (body.logic !== undefined) {
      data.logic = body.logic === null ? null : JSON.stringify(body.logic)
    }
    if (body.caseSensitive !== undefined) data.caseSensitive = Boolean(body.caseSensitive)
    if (body.wholeWord !== undefined) data.wholeWord = Boolean(body.wholeWord)

    const updated = await db.loreEntry.update({ where: { id }, data })
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
    await db.loreEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
