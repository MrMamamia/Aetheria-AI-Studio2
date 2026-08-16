import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray, parseJson } from '@/lib/api-shared'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const original = await db.character.findUnique({ where: { id } })
    if (!original) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const created = await db.character.create({
      data: {
        name: `${original.name} (Copy)`,
        avatar: original.avatar,
        description: original.description,
        creator: original.creator,
        version: original.version,
        tags: original.tags,
        favorite: false, // reset
        personality: original.personality,
        traits: original.traits,
        behavior: original.behavior,
        values: original.values,
        goals: original.goals,
        likes: original.likes,
        dislikes: original.dislikes,
        emotionalTendency: original.emotionalTendency,
        speakingStyle: original.speakingStyle,
        scenario: original.scenario,
        setting: original.setting,
        location: original.location,
        currentSituation: original.currentSituation,
        relationship: original.relationship,
        worldContext: original.worldContext,
        firstMessage: original.firstMessage,
        alternateGreetings: original.alternateGreetings,
        exampleDialogue: original.exampleDialogue,
        speechPatterns: original.speechPatterns,
        characterInstructions: original.characterInstructions,
        behavioralRules: original.behavioralRules,
        responseInstructions: original.responseInstructions,
        formattingRules: original.formattingRules,
        roleplayInstructions: original.roleplayInstructions,
        customFields: original.customFields,
        notes: original.notes,
      },
    })

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
