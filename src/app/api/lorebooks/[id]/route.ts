import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJson } from '@/lib/api-shared'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const book = await db.lorebook.findUnique({
      where: { id },
      include: {
        entries: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(book)
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
    const data: Prisma.LorebookUpdateInput = {}
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description
    if (body.tokenBudget !== undefined) data.tokenBudget = Number(body.tokenBudget)
    if (body.scanDepth !== undefined) data.scanDepth = Number(body.scanDepth)
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)
    if (body.boundCharacters !== undefined) {
      data.boundCharacters = stringifyJson(body.boundCharacters)
    }
    const updated = await db.lorebook.update({ where: { id }, data })
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
    await db.lorebook.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
