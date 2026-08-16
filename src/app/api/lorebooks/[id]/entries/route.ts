import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJson } from '@/lib/api-shared'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const book = await db.lorebook.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!book) {
      return NextResponse.json({ error: 'Lorebook not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const created = await db.loreEntry.create({
      data: {
        lorebookId: id,
        keys: stringifyJson(Array.isArray(body.keys) ? body.keys : []),
        aliases: stringifyJson(Array.isArray(body.aliases) ? body.aliases : []),
        content: body.content ?? '',
        comment: body.comment ?? null,
        enabled: body.enabled !== false,
        position: Number(body.position ?? 0),
        order: Number(body.order ?? 100),
        depth: Number(body.depth ?? 4),
        weight: Number(body.weight ?? 100),
        activation: Number(body.activation ?? 0),
        logic: body.logic !== undefined ? (body.logic ? JSON.stringify(body.logic) : null) : null,
        caseSensitive: Boolean(body.caseSensitive),
        wholeWord: Boolean(body.wholeWord),
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
