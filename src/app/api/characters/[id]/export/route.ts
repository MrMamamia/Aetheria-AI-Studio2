import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStringArray, parseJson } from '@/lib/api-shared'
import type { CharacterCard } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const character = await db.character.findUnique({ where: { id } })
    if (!character) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const card: CharacterCard = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: character.name,
        description: character.description ?? '',
        personality: character.personality ?? '',
        scenario: character.scenario ?? '',
        first_mes: character.firstMessage ?? '',
        alternate_greetings: parseStringArray(character.alternateGreetings),
        mes_example: character.exampleDialogue ?? '',
        creator_notes: character.notes ?? '',
        system_prompt: character.characterInstructions ?? '',
        post_history_instructions: character.responseInstructions ?? '',
        tags: parseStringArray(character.tags),
        creator: character.creator ?? '',
        character_version: character.version,
        avatar: character.avatar ?? undefined,
        traits: parseStringArray(character.traits),
        behavior: character.behavior ?? undefined,
        values: character.values ?? undefined,
        goals: character.goals ?? undefined,
        likes: character.likes ?? undefined,
        dislikes: character.dislikes ?? undefined,
        emotional_tendency: character.emotionalTendency ?? undefined,
        speaking_style: character.speakingStyle ?? undefined,
        setting: character.setting ?? undefined,
        location: character.location ?? undefined,
        current_situation: character.currentSituation ?? undefined,
        relationship: character.relationship ?? undefined,
        world_context: character.worldContext ?? undefined,
        speech_patterns: character.speechPatterns ?? undefined,
        behavioral_rules: character.behavioralRules ?? undefined,
        response_instructions: character.responseInstructions ?? undefined,
        formatting_rules: character.formattingRules ?? undefined,
        roleplay_instructions: character.roleplayInstructions ?? undefined,
        custom_fields: parseJson(character.customFields, []),
      },
    }

    const safeName = character.name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'character'
    const body = JSON.stringify(card, null, 2)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.json"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
