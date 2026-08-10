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

    const result = await db.$transaction(async (tx) => {
      const original = await tx.message.findUnique({ where: { id } })
      if (!original) throw new Error('Message not found')

      // Create a sibling with same parentId, same role, new content
      const newMsg = await tx.message.create({
        data: {
          chatId: original.chatId,
          role: original.role,
          content: String(content),
          parentId: original.parentId,
          isActive: true,
          swipes: stringifyJson([]),
        },
      })

      // Deactivate other siblings (including the original message)
      if (original.parentId) {
        await tx.message.updateMany({
          where: {
            parentId: original.parentId,
            id: { not: newMsg.id },
          },
          data: { isActive: false },
        })
        await tx.message.update({
          where: { id: original.parentId },
          data: { activeChildId: newMsg.id },
        })
      } else {
        // Root branch — also deactivate the original message
        await tx.message.update({
          where: { id: original.id },
          data: { isActive: false },
        })
      }

      const parent = original.parentId
        ? await tx.message.findUnique({ where: { id: original.parentId } })
        : null

      return { newMsg, parent }
    })

    return NextResponse.json(
      {
        message: {
          ...result.newMsg,
          swipes: parseStringArray(result.newMsg.swipes),
        },
        parent: result.parent
          ? {
              ...result.parent,
              swipes: parseStringArray(result.parent.swipes),
            }
          : null,
      },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
