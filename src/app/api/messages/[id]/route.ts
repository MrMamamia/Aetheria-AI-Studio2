import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray, stringifyJson } from '@/lib/api-shared'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Recursively collect all descendant message ids of a given message. */
async function collectDescendants(parentId: string): Promise<string[]> {
  const out: string[] = []
  let queue = [parentId]
  // BFS — protect against cycles with a visited set
  const visited = new Set<string>()
  while (queue.length) {
    const children = await db.message.findMany({
      where: { parentId: { in: queue } },
      select: { id: true },
    })
    const next: string[] = []
    for (const c of children) {
      if (!visited.has(c.id)) {
        visited.add(c.id)
        out.push(c.id)
        next.push(c.id)
      }
    }
    queue = next
  }
  return out
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const data: Prisma.MessageUpdateInput = {}
    if (body.content !== undefined) data.content = String(body.content)
    if (body.isPinned !== undefined) data.isPinned = Boolean(body.isPinned)
    if (body.isImportant !== undefined) data.isImportant = Boolean(body.isImportant)
    if (body.swipeIndex !== undefined) data.swipeIndex = Number(body.swipeIndex)

    // If content updates and swipeIndex is given, also sync swipes[swipeIndex]
    if (body.content !== undefined && typeof body.swipeIndex === 'number') {
      const existing = await db.message.findUnique({ where: { id } })
      if (existing) {
        const swipes = parseStringArray(existing.swipes)
        while (swipes.length <= body.swipeIndex) swipes.push('')
        swipes[body.swipeIndex] = String(body.content)
        data.swipes = stringifyJson(swipes)
      }
    }

    const updated = await db.message.update({ where: { id }, data })
    return NextResponse.json({
      ...updated,
      swipes: parseStringArray(updated.swipes),
    })
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
    // Collect descendants and delete the whole subtree, including the root.
    const descendantIds = await collectDescendants(id)
    const allIds = [id, ...descendantIds]

    // If this message has a parent, and it was the active child, clear that pointer.
    const target = await db.message.findUnique({
      where: { id },
      select: { parentId: true },
    })
    if (target?.parentId) {
      await db.message.updateMany({
        where: { id: target.parentId, activeChildId: id },
        data: { activeChildId: null },
      })
    }

    await db.message.deleteMany({ where: { id: { in: allIds } } })
    return NextResponse.json({ ok: true, deleted: allIds.length })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
