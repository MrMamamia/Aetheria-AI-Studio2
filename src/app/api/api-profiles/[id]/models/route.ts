import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PROVIDERS } from '@/lib/providers'
import { listModels } from '@/lib/ai-runtime'
import type { ProviderType } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    // Load the stored profile so we can fall back to its stored key and URL.
    const profile = await db.apiProfile.findUnique({ where: { id } })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const provider = (body.provider ?? profile.provider) as ProviderType
    const apiKey = body.apiKey?.trim()
      ? body.apiKey.trim()
      : profile.apiKey ?? undefined
    const baseUrl = body.baseUrl ?? profile.baseUrl ?? undefined

    const fetched = await listModels({ provider, baseUrl, apiKey })
    if (fetched.length > 0) {
      return NextResponse.json({ models: fetched, source: 'api' })
    }

    // The provider doesn't expose /models — fall back to the built-in list.
    const meta = PROVIDERS[provider] || PROVIDERS.openai
    return NextResponse.json({
      models: meta.defaultModels.map((m) => m.id),
      source: 'fallback',
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
