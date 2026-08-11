import type { ProviderCapabilities, ProviderType } from './types'

// Provider metadata + capability matrix.
// The Z.AI Cloud provider works out-of-the-box via z-ai-web-dev-sdk.
export const PROVIDERS: Record<
  ProviderType,
  {
    label: string
    description: string
    capabilities: ProviderCapabilities
    needsBaseUrl: boolean
    needsApiKey: boolean
    defaultModels: { id: string; name: string; contextWindow: number }[]
    builtin: boolean
  }
> = {
  zai: {
    label: 'Z.AI Cloud',
    description: 'Built-in provider. Works out of the box — no configuration required.',
    capabilities: {
      temperature: true,
      topP: true,
      topK: false,
      minP: false,
      repetitionPenalty: false,
      frequencyPenalty: false,
      presencePenalty: false,
      maxTokens: false,
      stop: false,
      seed: false,
      stream: true,
      systemPrompt: true,
    },
    needsBaseUrl: false,
    needsApiKey: false,
    defaultModels: [
      { id: 'glm-4.6', name: 'GLM-4.6', contextWindow: 131072 },
      { id: 'glm-4.5', name: 'GLM-4.5', contextWindow: 131072 },
    ],
    builtin: true,
  },
  openai: {
    label: 'OpenAI',
    description: 'Official OpenAI API. Requires an API key from platform.openai.com.',
    capabilities: {
      temperature: true,
      topP: true,
      topK: false,
      minP: false,
      repetitionPenalty: false,
      frequencyPenalty: true,
      presencePenalty: true,
      maxTokens: true,
      stop: true,
      seed: true,
      stream: true,
      systemPrompt: true,
    },
    needsBaseUrl: false,
    needsApiKey: true,
    defaultModels: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000 },
      { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576 },
    ],
    builtin: false,
  },
  anthropic: {
    label: 'Anthropic',
    description: 'Official Anthropic Claude API. Requires an API key from console.anthropic.com.',
    capabilities: {
      temperature: true,
      topP: true,
      topK: true,
      minP: false,
      repetitionPenalty: false,
      frequencyPenalty: false,
      presencePenalty: false,
      maxTokens: true,
      stop: true,
      seed: false,
      stream: true,
      systemPrompt: true,
    },
    needsBaseUrl: false,
    needsApiKey: true,
    defaultModels: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000 },
    ],
    builtin: false,
  },
  'openai-compatible': {
    label: 'OpenAI-Compatible',
    description: 'Any endpoint exposing an OpenAI-compatible /v1/chat/completions API (LM Studio, Ollama, vLLM, etc.).',
    capabilities: {
      temperature: true,
      topP: true,
      topK: true,
      minP: true,
      repetitionPenalty: true,
      frequencyPenalty: true,
      presencePenalty: true,
      maxTokens: true,
      stop: true,
      seed: true,
      stream: true,
      systemPrompt: true,
    },
    needsBaseUrl: true,
    needsApiKey: false,
    defaultModels: [
      { id: 'local-model', name: 'Local Model', contextWindow: 8192 },
    ],
    builtin: false,
  },
}

export const DEFAULT_GEN_PARAMS = {
  temperature: 0.9,
  topP: 1,
  topK: 40,
  minP: 0,
  repetitionPenalty: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxTokens: 512,
  stop: [],
  seed: undefined,
  stream: true,
}

export const DEFAULT_PROMPT_SETTINGS = {
  contextSize: 8192,
  maxResponseTokens: 512,
  includePersona: true,
  includeScenario: true,
  includeLore: true,
  includeMemory: true,
  recentMessages: 20,
}

export const DEFAULT_PRESETS = [
  {
    name: 'Creative',
    description: 'Higher temperature for expressive, varied responses.',
    genParams: { temperature: 1.1, topP: 0.95, maxTokens: 768, stream: true },
    promptSettings: { contextSize: 8192, maxResponseTokens: 768, recentMessages: 24 },
  },
  {
    name: 'Balanced',
    description: 'A sensible default for general roleplay and conversation.',
    genParams: { temperature: 0.9, topP: 1, maxTokens: 512, stream: true },
    promptSettings: { contextSize: 8192, maxResponseTokens: 512, recentMessages: 20 },
  },
  {
    name: 'Precise',
    description: 'Lower temperature for coherent, on-task responses.',
    genParams: { temperature: 0.5, topP: 0.8, maxTokens: 512, stream: true },
    promptSettings: { contextSize: 8192, maxResponseTokens: 512, recentMessages: 16 },
  },
  {
    name: 'Long-form',
    description: 'Longer responses for narrative and story-driven roleplay.',
    genParams: { temperature: 0.95, topP: 0.98, maxTokens: 1280, stream: true },
    promptSettings: { contextSize: 16384, maxResponseTokens: 1280, recentMessages: 30 },
  },
]

// Approximate token counter (4 chars ≈ 1 token). Good enough for budgeting.
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}
