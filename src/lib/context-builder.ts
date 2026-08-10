import 'server-only'
import type { BuiltContext, ChatMessageInput, ContextSection, GenParams, PromptSettings } from './types'
import { estimateTokens } from './providers'
import type { Character, Persona, Memory, LoreEntry, Lorebook } from '@prisma/client'
import { db } from './db'

function safeParseArr(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

/** Build the full prompt pipeline for a chat turn. */
export async function buildContext(args: {
  character: Character
  persona: Persona | null
  messages: { role: string; content: string }[]
  promptSettings: PromptSettings
  genParams: GenParams
  chatId: string
  characterLorebooks: Lorebook[]
  userInput: string
}): Promise<BuiltContext> {
  const {
    character,
    persona,
    messages,
    promptSettings,
    chatId,
    characterLorebooks,
    userInput,
  } = args

  const sections: ContextSection[] = []
  const contextLimit = promptSettings.contextSize || 8192

  // 1. System prompt — main directive
  const sysParts: string[] = []
  sysParts.push(
    'You are an expert roleplayer. Stay in character at all times. Write vivid, immersive responses. Use *asterisks* for actions/narration and "quotes" for speech. Do not break character or mention being an AI.',
  )
  if (character.characterInstructions) {
    sysParts.push(character.characterInstructions)
  }
  if (character.behavioralRules) {
    sysParts.push(`Behavioral rules:\n${character.behavioralRules}`)
  }
  if (character.formattingRules) {
    sysParts.push(`Formatting rules:\n${character.formattingRules}`)
  }
  if (character.roleplayInstructions) {
    sysParts.push(character.roleplayInstructions)
  }
  sections.push({
    id: 'system',
    label: 'System',
    role: 'system',
    content: sysParts.join('\n\n'),
    tokens: 0,
    source: 'system',
    enabled: true,
  })

  // 2. Character description
  const charParts: string[] = [`Name: ${character.name}`]
  if (character.description) charParts.push(`Description: ${character.description}`)
  if (character.personality) charParts.push(`Personality: ${character.personality}`)
  const traits = safeParseArr(character.traits)
  if (traits.length) charParts.push(`Traits: ${traits.join(', ')}`)
  if (character.behavior) charParts.push(`Behavior: ${character.behavior}`)
  if (character.values) charParts.push(`Values: ${character.values}`)
  if (character.goals) charParts.push(`Goals: ${character.goals}`)
  if (character.likes) charParts.push(`Likes: ${character.likes}`)
  if (character.dislikes) charParts.push(`Dislikes: ${character.dislikes}`)
  if (character.emotionalTendency) charParts.push(`Emotional tendency: ${character.emotionalTendency}`)
  if (character.speakingStyle) charParts.push(`Speaking style: ${character.speakingStyle}`)
  sections.push({
    id: 'character',
    label: 'Character',
    role: 'system',
    content: charParts.join('\n'),
    tokens: 0,
    source: 'character',
    enabled: true,
  })

  // 3. Persona
  if (promptSettings.includePersona && persona) {
    const pParts: string[] = [`User persona — ${persona.name}:`]
    if (persona.description) pParts.push(persona.description)
    if (persona.personality) pParts.push(`Personality: ${persona.personality}`)
    if (persona.background) pParts.push(`Background: ${persona.background}`)
    if (persona.appearance) pParts.push(`Appearance: ${persona.appearance}`)
    if (persona.behavior) pParts.push(`Behavior: ${persona.behavior}`)
    if (persona.speakingStyle) pParts.push(`Speaking style: ${persona.speakingStyle}`)
    if (persona.customInstructions) pParts.push(persona.customInstructions)
    sections.push({
      id: 'persona',
      label: 'Persona',
      role: 'system',
      content: pParts.join('\n'),
      tokens: 0,
      source: 'persona',
      enabled: true,
    })
  }

  // 4. Scenario
  if (promptSettings.includeScenario) {
    const scParts: string[] = []
    if (character.scenario) scParts.push(`Scenario: ${character.scenario}`)
    if (character.setting) scParts.push(`Setting: ${character.setting}`)
    if (character.location) scParts.push(`Location: ${character.location}`)
    if (character.currentSituation) scParts.push(`Current situation: ${character.currentSituation}`)
    if (character.relationship) scParts.push(`Relationship with user: ${character.relationship}`)
    if (character.worldContext) scParts.push(`World context: ${character.worldContext}`)
    if (scParts.length) {
      sections.push({
        id: 'scenario',
        label: 'Scenario',
        role: 'system',
        content: scParts.join('\n'),
        tokens: 0,
        source: 'scenario',
        enabled: true,
      })
    }
  }

  // 5. Lore — keyword-activated entries scanned against recent context + user input
  if (promptSettings.includeLore && characterLorebooks.length) {
    const scanText = (messages.slice(-8).map((m) => m.content).join('\n') + '\n' + userInput).toLowerCase()
    const activated: { entry: LoreEntry; book: Lorebook }[] = []
    for (const book of characterLorebooks) {
      if (!book.enabled) continue
      const entries = await db.loreEntry.findMany({ where: { lorebookId: book.id, enabled: true } })
      for (const entry of entries) {
        if (entry.activation === 1) {
          activated.push({ entry, book })
          continue
        }
        const keys = [...safeParseArr(entry.keys), ...safeParseArr(entry.aliases)]
        const hit = keys.some((k) => {
          if (!k) return false
          if (entry.wholeWord) {
            const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, entry.caseSensitive ? '' : 'i')
            return re.test(scanText)
          }
          return entry.caseSensitive ? scanText.includes(k) : scanText.toLowerCase().includes(k.toLowerCase())
        })
        if (hit) activated.push({ entry, book })
      }
    }
    // sort by order asc, weight desc
    activated.sort((a, b) => a.entry.order - b.entry.order || b.entry.weight - a.entry.weight)
    const loreText = activated.map((a) => a.entry.content).filter(Boolean).join('\n\n')
    if (loreText) {
      sections.push({
        id: 'lore',
        label: `Lore (${activated.length} entries)`,
        role: 'system',
        content: loreText,
        tokens: 0,
        source: 'lore',
        enabled: true,
      })
    }
  }

  // 6. Memory — summaries + pinned facts for this chat / character
  if (promptSettings.includeMemory) {
    const memories = await db.memory.findMany({
      where: {
        enabled: true,
        OR: [{ chatId }, { characterId: character.id }],
      },
      orderBy: { createdAt: 'desc' },
    })
    const memText = memories.map((m) => m.content).filter(Boolean).join('\n')
    if (memText) {
      sections.push({
        id: 'memory',
        label: `Memory (${memories.length})`,
        role: 'system',
        content: memText,
        tokens: 0,
        source: 'memory',
        enabled: true,
      })
    }
  }

  // 7. Example dialogue
  if (character.exampleDialogue) {
    sections.push({
      id: 'examples',
      label: 'Example Dialogue',
      role: 'system',
      content: `Example of how ${character.name} speaks and acts:\n${character.exampleDialogue}`,
      tokens: 0,
      source: 'instruction',
      enabled: true,
    })
  }

  // Compute tokens for each section
  for (const s of sections) s.tokens = estimateTokens(s.content)

  // 8. Conversation history — assemble system messages + chat history
  const systemContent = sections.map((s) => s.content).join('\n\n---\n\n')
  const finalMessages: ChatMessageInput[] = [
    { role: 'system', content: systemContent },
  ]

  // First message as greeting if no history
  if (messages.length === 0 && character.firstMessage) {
    finalMessages.push({ role: 'assistant', content: character.firstMessage })
  }

  // Recent messages (respect budget)
  const systemTokens = estimateTokens(systemContent)
  const reserve = promptSettings.maxResponseTokens || 512
  const budget = contextLimit - systemTokens - reserve
  let historyTokens = 0
  const recent = messages.slice(-(promptSettings.recentMessages || 20))
  const trimmed: ChatMessageInput[] = []
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]
    const t = estimateTokens(m.content)
    if (historyTokens + t > budget) break
    historyTokens += t
    trimmed.unshift({ role: m.role as 'user' | 'assistant', content: m.content })
  }
  finalMessages.push(...trimmed)

  // Append the current user input as the final user message (for 'send' and
  // 'regenerate' modes). The generate route excludes the just-created user
  // message from history and passes it here so it becomes the explicit final
  // turn the model responds to. 'continue' mode passes empty userInput.
  if (userInput && userInput.trim()) {
    finalMessages.push({ role: 'user', content: userInput })
    historyTokens += estimateTokens(userInput)
  }

  const totalTokens = systemTokens + historyTokens

  return {
    sections,
    messages: finalMessages,
    totalTokens,
    contextLimit,
  }
}
