import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const books = await db.lorebook.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: { _count: { select: { entries: true } } },
    })
    return NextResponse.json(books)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const data: Prisma.LorebookCreateInput = {
      name: body.name || 'New Lorebook',
      description: body.description ?? null,
      tokenBudget: Number(body.tokenBudget ?? 2048),
      scanDepth: Number(body.scanDepth ?? 1),
      enabled: body.enabled !== false,
      boundCharacters: body.boundCharacters
        ? JSON.stringify(body.boundCharacters)
        : '[]',
    }
    const created = await db.lorebook.create({ data })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
