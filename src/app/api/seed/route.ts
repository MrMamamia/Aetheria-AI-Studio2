import { NextResponse } from 'next/server'
import { ensureSeed } from '@/lib/seed'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function POST() {
  try {
    await ensureSeed()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
