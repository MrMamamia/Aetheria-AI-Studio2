import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray, parseJson, stringifyJson } from '@/lib/api-shared'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const character = await db.character.findUnique({
      where: { id },
      include: {
        chats: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            pinned: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })
    if (!character) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      ...character,
      tags: parseStringArray(character.tags),
      traits: parseStringArray(character.traits),
      alternateGreetings: parseStringArray(character.alternateGreetings),
      customFields: parseJson(character.customFields, []),
    })
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

    const data: Prisma.CharacterUpdateInput = {}
    if (body.name !== undefined) data.name = body.name
    if (body.avatar !== undefined) data.avatar = body.avatar
    if (body.description !== undefined) data.description = body.description
    if (body.creator !== undefined) data.creator = body.creator
    if (body.version !== undefined) data.version = body.version
    if (body.tags !== undefined) data.tags = stringifyJson(body.tags)
    if (body.favorite !== undefined) data.favorite = Boolean(body.favorite)
    if (body.personality !== undefined) data.personality = body.personality
    if (body.traits !== undefined) data.traits = stringifyJson(body.traits)
    if (body.behavior !== undefined) data.behavior = body.behavior
    if (body.values !== undefined) data.values = body.values
    if (body.goals !== undefined) data.goals = body.goals
    if (body.likes !== undefined) data.likes = body.likes
    if (body.dislikes !== undefined) data.dislikes = body.dislikes
    if (body.emotionalTendency !== undefined) data.emotionalTendency = body.emotionalTendency
    if (body.speakingStyle !== undefined) data.speakingStyle = body.speakingStyle
    if (body.scenario !== undefined) data.scenario = body.scenario
    if (body.setting !== undefined) data.setting = body.setting
    if (body.location !== undefined) data.location = body.location
    if (body.currentSituation !== undefined) data.currentSituation = body.currentSituation
    if (body.relationship !== undefined) data.relationship = body.relationship
    if (body.worldContext !== undefined) data.worldContext = body.worldContext
    if (body.firstMessage !== undefined) data.firstMessage = body.firstMessage
    if (body.alternateGreetings !== undefined)
      data.alternateGreetings = stringifyJson(body.alternateGreetings)
    if (body.exampleDialogue !== undefined) data.exampleDialogue = body.exampleDialogue
    if (body.speechPatterns !== undefined) data.speechPatterns = body.speechPatterns
    if (body.characterInstructions !== undefined) data.characterInstructions = body.characterInstructions
    if (body.behavioralRules !== undefined) data.behavioralRules = body.behavioralRules
    if (body.responseInstructions !== undefined) data.responseInstructions = body.responseInstructions
    if (body.formattingRules !== undefined) data.formattingRules = body.formattingRules
    if (body.roleplayInstructions !== undefined) data.roleplayInstructions = body.roleplayInstructions
    if (body.customFields !== undefined) data.customFields = stringifyJson(body.customFields)
    if (body.notes !== undefined) data.notes = body.notes

    const updated = await db.character.update({ where: { id }, data })
    return NextResponse.json({
      ...updated,
      tags: parseStringArray(updated.tags),
      traits: parseStringArray(updated.traits),
      alternateGreetings: parseStringArray(updated.alternateGreetings),
      customFields: parseJson(updated.customFields, []),
    })
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
    await db.character.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
