import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJson } from '@/lib/api-shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await db.setting.findMany()
    const out: Record<string, unknown> = {}
    for (const s of settings) {
      // Try to parse JSON values; fall back to raw string
      try {
        out[s.key] = JSON.parse(s.value)
      } catch {
        out[s.key] = s.value
      }
    }
    return NextResponse.json(out)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Accept either `{ key, value }` or a flat object of multiple keys.
    const entries: { key: string; value: unknown }[] = []
    if (body && typeof body === 'object' && 'key' in body && 'value' in body) {
      entries.push({ key: String(body.key), value: body.value })
    } else if (body && typeof body === 'object') {
      for (const [k, v] of Object.entries(body)) {
        entries.push({ key: k, value: v })
      }
    }

    if (!entries.length) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 })
    }

    await db.$transaction(
      entries.map((e) => {
        const value =
          typeof e.value === 'string' ? e.value : stringifyJson(e.value)
        return db.setting.upsert({
          where: { key: e.key },
          update: { value },
          create: { key: e.key, value },
        })
      }),
    )

    // Return the updated settings object
    const all = await db.setting.findMany()
    const out: Record<string, unknown> = {}
    for (const s of all) {
      try {
        out[s.key] = JSON.parse(s.value)
      } catch {
        out[s.key] = s.value
      }
    }
    return NextResponse.json(out)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
