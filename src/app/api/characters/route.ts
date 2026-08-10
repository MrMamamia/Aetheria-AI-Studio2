import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray, parseJson, stringifyJson } from '@/lib/api-shared'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const tag = searchParams.get('tag')?.trim() || ''
    const sort = searchParams.get('sort') || 'recent'

    const where: Prisma.CharacterWhereInput = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { creator: { contains: search } },
      ]
    }
    if (tag) {
      // SQLite doesn't support array contains — fetch all and filter.
      // We'll filter post-query for tag matching.
    }

    let orderBy: Prisma.CharacterOrderByWithRelationInput
    if (sort === 'name') orderBy = { name: 'asc' }
    else if (sort === 'favorite') orderBy = [{ favorite: 'desc' }, { updatedAt: 'desc' }]
    else orderBy = { updatedAt: 'desc' }

    const characters = await db.character.findMany({
      where,
      orderBy,
      include: {
        _count: { select: { chats: true } },
      },
    })

    let result = characters
    if (tag) {
      result = characters.filter((c) => parseStringArray(c.tags).includes(tag))
    }

    // Parse JSON fields for client convenience
    const out = result.map((c) => ({
      ...c,
      tags: parseStringArray(c.tags),
      traits: parseStringArray(c.traits),
      alternateGreetings: parseStringArray(c.alternateGreetings),
      customFields: parseJson(c.customFields, []),
    }))

    return NextResponse.json(out)
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
    const data: Prisma.CharacterCreateInput = {
      name: body.name || 'New Character',
      avatar: body.avatar ?? null,
      description: body.description ?? null,
      creator: body.creator ?? null,
      version: body.version ?? '1.0',
      tags: stringifyJson(Array.isArray(body.tags) ? body.tags : []),
      favorite: Boolean(body.favorite),
      personality: body.personality ?? null,
      traits: stringifyJson(Array.isArray(body.traits) ? body.traits : []),
      behavior: body.behavior ?? null,
      values: body.values ?? null,
      goals: body.goals ?? null,
      likes: body.likes ?? null,
      dislikes: body.dislikes ?? null,
      emotionalTendency: body.emotionalTendency ?? null,
      speakingStyle: body.speakingStyle ?? null,
      scenario: body.scenario ?? null,
      setting: body.setting ?? null,
      location: body.location ?? null,
      currentSituation: body.currentSituation ?? null,
      relationship: body.relationship ?? null,
      worldContext: body.worldContext ?? null,
      firstMessage: body.firstMessage ?? null,
      alternateGreetings: stringifyJson(
        Array.isArray(body.alternateGreetings) ? body.alternateGreetings : [],
      ),
      exampleDialogue: body.exampleDialogue ?? null,
      speechPatterns: body.speechPatterns ?? null,
      characterInstructions: body.characterInstructions ?? null,
      behavioralRules: body.behavioralRules ?? null,
      responseInstructions: body.responseInstructions ?? null,
      formattingRules: body.formattingRules ?? null,
      roleplayInstructions: body.roleplayInstructions ?? null,
      customFields: stringifyJson(
        Array.isArray(body.customFields) ? body.customFields : [],
      ),
      notes: body.notes ?? null,
    }

    const created = await db.character.create({ data })
    return NextResponse.json(
      {
        ...created,
        tags: parseStringArray(created.tags),
        traits: parseStringArray(created.traits),
        alternateGreetings: parseStringArray(created.alternateGreetings),
        customFields: parseJson(created.customFields, []),
      },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
