import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildActiveTimeline, parseStringArray } from '@/lib/api-shared'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const chat = await db.chat.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const messages = await db.message.findMany({
      where: { chatId: id },
      orderBy: { createdAt: 'asc' },
    })

    const timeline = buildActiveTimeline(messages).map((m) => ({
      ...m,
      swipes: parseStringArray(m.swipes),
    }))

    return NextResponse.json(timeline)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
