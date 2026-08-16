import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripApiKey, stringifyJson } from '@/lib/api-shared'
import { PROVIDERS } from '@/lib/providers'
import type { Prisma, ProviderType } from '@prisma/client'
import type { ProviderType as ProviderTypeT } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const profiles = await db.apiProfile.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(profiles.map(stripApiKey))
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
    const provider = (body.provider || 'openai') as ProviderType
    const capSource = PROVIDERS[provider as ProviderTypeT] || PROVIDERS.openai
    const capabilities =
      body.capabilities !== undefined
        ? typeof body.capabilities === 'string'
          ? body.capabilities
          : stringifyJson(body.capabilities)
        : stringifyJson(capSource.capabilities)

    const data: Prisma.ApiProfileCreateInput = {
      name: body.name || 'New API Profile',
      provider,
      baseUrl: body.baseUrl ?? null,
      apiKey: body.apiKey ?? null,
      modelName: body.modelName ?? null,
      capabilities,
      isDefault: Boolean(body.isDefault),
    }

    const created = await db.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.apiProfile.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.apiProfile.create({ data })
    })

    return NextResponse.json(stripApiKey(created), { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
