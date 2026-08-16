// Shared application types

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'mistral'
  | 'together'
  | 'perplexity'
  | 'openai-compatible'
  | 'zai'

export interface GenParams {
  temperature?: number
  topP?: number
  topK?: number
  minP?: number
  repetitionPenalty?: number
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
  stop?: string[]
  seed?: number
  stream?: boolean
}

export interface PromptSettings {
  contextSize?: number        // max context tokens for this chat
  maxResponseTokens?: number
  // prompt order / inclusion toggles
  includePersona?: boolean
  includeScenario?: boolean
  includeLore?: boolean
  includeMemory?: boolean
  // how many messages to keep in recent history
  recentMessages?: number
}

export interface ProviderCapabilities {
  temperature: boolean
  topP: boolean
  topK: boolean
  minP: boolean
  repetitionPenalty: boolean
  frequencyPenalty: boolean
  presencePenalty: boolean
  maxTokens: boolean
  stop: boolean
  seed: boolean
  stream: boolean
  systemPrompt: boolean
}

export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ProviderModelInfo {
  id: string
  name: string
  contextWindow: number
}

export interface ApiProfileConfig {
  id?: string
  name: string
  provider: ProviderType
  baseUrl?: string
  apiKey?: string
  modelName?: string
  isDefault?: boolean
}

export interface CharacterCard {
  // V2-compatible-ish export shape
  spec: string
  spec_version: string
  data: {
    name: string
    description: string
    personality: string
    scenario: string
    first_mes: string
    alternate_greetings: string[]
    mes_example: string
    creator_notes: string
    system_prompt: string
    post_history_instructions: string
    tags: string[]
    creator: string
    character_version: string
    avatar?: string
    // extended fields
    traits?: string[]
    behavior?: string
    values?: string
    goals?: string
    likes?: string
    dislikes?: string
    emotional_tendency?: string
    speaking_style?: string
    setting?: string
    location?: string
    current_situation?: string
    relationship?: string
    world_context?: string
    speech_patterns?: string
    behavioral_rules?: string
    response_instructions?: string
    formatting_rules?: string
    roleplay_instructions?: string
    custom_fields?: { key: string; label: string; value: string }[]
  }
}

export interface ContextSection {
  id: string
  label: string
  role: 'system' | 'user' | 'assistant'
  content: string
  tokens: number
  source: 'system' | 'character' | 'persona' | 'scenario' | 'lore' | 'memory' | 'history' | 'instruction'
  enabled: boolean
}

export interface BuiltContext {
  sections: ContextSection[]
  messages: ChatMessageInput[]
  totalTokens: number
  contextLimit: number
}

export type View =
  | 'chat'
  | 'characters'
  | 'character-editor'
  | 'personas'
  | 'lorebooks'
  | 'presets'
  | 'api'
  | 'settings'
  | 'memory'

export interface NavItem {
  id: View
  label: string
  icon: string
  group: 'workspace' | 'library' | 'system'
}
