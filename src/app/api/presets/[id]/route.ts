import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJson } from '@/lib/api-shared'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const data: Prisma.PresetUpdateInput = {}
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description
    if (body.providerType !== undefined) data.providerType = body.providerType
    if (body.modelName !== undefined) data.modelName = body.modelName
    if (body.apiProfileId !== undefined) {
      data.apiProfile = body.apiProfileId
        ? { connect: { id: body.apiProfileId } }
        : { disconnect: true }
    }
    if (body.genParams !== undefined) {
      data.genParams =
        typeof body.genParams === 'string'
          ? body.genParams
          : stringifyJson(body.genParams)
    }
    if (body.promptSettings !== undefined) {
      data.promptSettings =
        typeof body.promptSettings === 'string'
          ? body.promptSettings
          : stringifyJson(body.promptSettings)
    }
    if (body.isDefault !== undefined) data.isDefault = Boolean(body.isDefault)

    const updated = await db.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.preset.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        })
      }
      return tx.preset.update({ where: { id }, data })
    })

    return NextResponse.json(updated)
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
    await db.preset.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
