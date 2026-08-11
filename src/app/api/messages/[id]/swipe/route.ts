import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray, stringifyJson } from '@/lib/api-shared'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const content = body.content
    if (content === undefined) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const updated = await db.$transaction(async (tx) => {
      const msg = await tx.message.findUnique({ where: { id } })
      if (!msg) throw new Error('Message not found')

      const swipes = parseStringArray(msg.swipes)
      swipes.push(String(content))
      const newIndex = swipes.length - 1

      const out = await tx.message.update({
        where: { id },
        data: {
          swipes: stringifyJson(swipes),
          swipeIndex: newIndex,
          content: String(content), // active view shows new content
        },
      })
      return out
    })

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
