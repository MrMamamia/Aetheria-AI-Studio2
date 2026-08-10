import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray } from '@/lib/api-shared'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const childId = body.childId
    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 })
    }

    const parent = await db.$transaction(async (tx) => {
      // Verify child belongs to this parent
      const child = await tx.message.findUnique({ where: { id: childId } })
      if (!child) throw new Error('Child message not found')
      if (child.parentId !== id) {
        throw new Error('childId is not a child of this message')
      }

      // Deactivate siblings, activate target child
      await tx.message.updateMany({
        where: { parentId: id, id: { not: childId } },
        data: { isActive: false },
      })
      await tx.message.update({
        where: { id: childId },
        data: { isActive: true },
      })

      return await tx.message.update({
        where: { id },
        data: { activeChildId: childId },
      })
    })

    return NextResponse.json({
      ...parent,
      swipes: parseStringArray(parent.swipes),
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
