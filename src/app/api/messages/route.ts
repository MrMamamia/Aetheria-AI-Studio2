import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray, stringifyJson } from '@/lib/api-shared'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { chatId, role, content, parentId } = body
    if (!chatId || !role || content === undefined) {
      return NextResponse.json(
        { error: 'chatId, role and content are required' },
        { status: 400 },
      )
    }

    const created = await db.$transaction(async (tx) => {
      // If parentId provided: set parent's activeChildId to new message,
      // set siblings isActive=false, new message isActive=true.
      const newMsg = await tx.message.create({
        data: {
          chatId,
          role,
          content: String(content ?? ''),
          parentId: parentId ?? null,
          isActive: parentId ? true : true, // root messages are also active by default
          swipes: stringifyJson([]),
        },
      })

      if (parentId) {
        // Deactivate siblings (same parent, different id)
        await tx.message.updateMany({
          where: { parentId, id: { not: newMsg.id } },
          data: { isActive: false },
        })
        // Point parent's activeChildId at the new message
        await tx.message.update({
          where: { id: parentId },
          data: { activeChildId: newMsg.id },
        })
      }

      return newMsg
    })

    return NextResponse.json(
      {
        ...created,
        swipes: parseStringArray(created.swipes),
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
