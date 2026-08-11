import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJson } from '@/lib/api-shared'
import type { CharacterCard } from '@/lib/types'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CharacterCard> & {
      // Accept also a flat shape if caller didn't wrap in `data`.
      [k: string]: any
    }
    const d = (body.data ?? body) as CharacterCard['data'] & Record<string, any>

    const data: Prisma.CharacterCreateInput = {
      name: d.name || 'Imported Character',
      avatar: d.avatar ?? null,
      description: d.description ?? null,
      creator: d.creator ?? null,
      version: d.character_version ?? '1.0',
      tags: stringifyJson(Array.isArray(d.tags) ? d.tags : []),
      favorite: false,
      personality: d.personality ?? null,
      traits: stringifyJson(Array.isArray(d.traits) ? d.traits : []),
      behavior: d.behavior ?? null,
      values: d.values ?? null,
      goals: d.goals ?? null,
      likes: d.likes ?? null,
      dislikes: d.dislikes ?? null,
      emotionalTendency: d.emotional_tendency ?? null,
      speakingStyle: d.speaking_style ?? null,
      scenario: d.scenario ?? null,
      setting: d.setting ?? null,
      location: d.location ?? null,
      currentSituation: d.current_situation ?? null,
      relationship: d.relationship ?? null,
      worldContext: d.world_context ?? null,
      firstMessage: d.first_mes ?? null,
      alternateGreetings: stringifyJson(
        Array.isArray(d.alternate_greetings) ? d.alternate_greetings : [],
      ),
      exampleDialogue: d.mes_example ?? null,
      speechPatterns: d.speech_patterns ?? null,
      characterInstructions: d.system_prompt ?? null,
      behavioralRules: d.behavioral_rules ?? null,
      responseInstructions: d.response_instructions ?? null,
      formattingRules: d.formatting_rules ?? null,
      roleplayInstructions: d.roleplay_instructions ?? null,
      customFields: stringifyJson(
        Array.isArray(d.custom_fields) ? d.custom_fields : [],
      ),
      notes: d.creator_notes ?? null,
    }

    const created = await db.character.create({ data })
    return NextResponse.json({ id: created.id, name: created.name }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
