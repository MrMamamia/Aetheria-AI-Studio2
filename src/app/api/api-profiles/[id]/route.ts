import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripApiKey, stringifyJson } from '@/lib/api-shared'
import { PROVIDERS } from '@/lib/providers'
import type { Prisma } from '@prisma/client'
import type { ProviderType as ProviderTypeT } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const profile = await db.apiProfile.findUnique({ where: { id } })
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(stripApiKey(profile))
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const data: Prisma.ApiProfileUpdateInput = {}
    if (body.name !== undefined) data.name = body.name
    if (body.provider !== undefined) {
      data.provider = body.provider
      const capSource =
        PROVIDERS[body.provider as ProviderTypeT] || PROVIDERS.openai
      if (body.capabilities === undefined) {
        data.capabilities = stringifyJson(capSource.capabilities)
      }
    }
    if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl
    if (body.modelName !== undefined) data.modelName = body.modelName
    if (body.capabilities !== undefined) {
      data.capabilities =
        typeof body.capabilities === 'string'
          ? body.capabilities
          : stringifyJson(body.capabilities)
    }
    if (body.isDefault !== undefined) data.isDefault = Boolean(body.isDefault)

    // apiKey: if undefined or empty string -> keep existing. If provided -> update.
    if (body.apiKey && String(body.apiKey).trim().length > 0) {
      data.apiKey = String(body.apiKey)
    }

    const updated = await db.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.apiProfile.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        })
      }
      const result = await tx.apiProfile.update({ where: { id }, data })
      // "Select" from the API Manager: rebind every existing chat to this
      // profile so it is used universally across all characters.
      if (body.isDefault === true && body.applyToAllChats === true) {
        await tx.chat.updateMany({ data: { apiProfileId: id } })
      }
      return result
    })

    return NextResponse.json(stripApiKey(updated))
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
    await db.apiProfile.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
