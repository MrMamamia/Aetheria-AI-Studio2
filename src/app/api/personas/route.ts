import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const personas = await db.persona.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(personas)
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
    const data: Prisma.PersonaCreateInput = {
      name: body.name || 'New Persona',
      description: body.description ?? null,
      personality: body.personality ?? null,
      background: body.background ?? null,
      appearance: body.appearance ?? null,
      behavior: body.behavior ?? null,
      speakingStyle: body.speakingStyle ?? null,
      customInstructions: body.customInstructions ?? null,
      isDefault: Boolean(body.isDefault),
    }

    const created = await db.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.persona.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.persona.create({ data })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
