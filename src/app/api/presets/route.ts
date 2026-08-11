import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJson } from '@/lib/api-shared'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const presets = await db.preset.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: { apiProfile: { select: { id: true, name: true, provider: true } } },
    })
    return NextResponse.json(presets)
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
    const data: Prisma.PresetCreateInput = {
      name: body.name || 'New Preset',
      description: body.description ?? null,
      providerType: body.providerType ?? null,
      modelName: body.modelName ?? null,
      apiProfile: body.apiProfileId
        ? { connect: { id: body.apiProfileId } }
        : undefined,
      genParams: body.genParams
        ? typeof body.genParams === 'string'
          ? body.genParams
          : stringifyJson(body.genParams)
        : '{}',
      promptSettings: body.promptSettings
        ? typeof body.promptSettings === 'string'
          ? body.promptSettings
          : stringifyJson(body.promptSettings)
        : '{}',
      isDefault: Boolean(body.isDefault),
    }

    const created = await db.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.preset.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.preset.create({ data })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
