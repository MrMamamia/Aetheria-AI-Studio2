import type { ProviderCapabilities, ProviderType } from './types'

export interface ProviderMeta {
  label: string
  description: string
  baseUrl?: string
  capabilities: ProviderCapabilities
  needsBaseUrl: boolean
  needsApiKey: boolean
  apiKeyUrl?: string
  defaultModels: { id: string; name: string; contextWindow: number }[]
  builtin: boolean
}

// Provider metadata + capability matrix. OpenAI is default.
export const PROVIDERS: Record<ProviderType, ProviderMeta> = {
  openai: {
    label: 'OpenAI',
    description: 'Official OpenAI API. Requires an API key from platform.openai.com.',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
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
      { id: 'o1', name: 'o1', contextWindow: 200000 },
      { id: 'o3-mini', name: 'o3-mini', contextWindow: 200000 },
    ],
    builtin: false,
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    description: 'Official Anthropic Claude API. Requires an API key from console.anthropic.com.',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
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
  google: {
    label: 'Google Gemini',
    description: 'Google Gemini OpenAI-compatible API. Requires an API key from Google AI Studio.',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
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
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 2097152 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2097152 },
    ],
    builtin: false,
  },
  groq: {
    label: 'Groq',
    description: 'Ultra-fast Llama, DeepSeek & more via LPU inference. Requires an API key from console.groq.com.',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyUrl: 'https://console.groq.com/keys',
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
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', contextWindow: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000 },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (reasoning)', contextWindow: 128000 },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (reasoning)', contextWindow: 128000 },
      { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B (reasoning)', contextWindow: 128000 },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B (reasoning)', contextWindow: 128000 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768 },
    ],
    builtin: false,
  },
  openrouter: {
    label: 'OpenRouter',
    description: 'Unified router for 200+ AI models (Claude, DeepSeek, Llama, GPT-4). Key from openrouter.ai.',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyUrl: 'https://openrouter.ai/keys',
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
    needsBaseUrl: false,
    needsApiKey: true,
    defaultModels: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', contextWindow: 163840 },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 131072 },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000 },
    ],
    builtin: false,
  },
  deepseek: {
    label: 'DeepSeek',
    description: 'Official DeepSeek AI API. Requires an API key from platform.deepseek.com.',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
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
      seed: false,
      stream: true,
      systemPrompt: true,
    },
    needsBaseUrl: false,
    needsApiKey: true,
    defaultModels: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', contextWindow: 64000 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', contextWindow: 64000 },
    ],
    builtin: false,
  },
  mistral: {
    label: 'Mistral AI',
    description: 'Official Mistral AI API. Requires an API key from console.mistral.ai.',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyUrl: 'https://console.mistral.ai/api-keys/',
    capabilities: {
      temperature: true,
      topP: true,
      topK: false,
      minP: false,
      repetitionPenalty: false,
      frequencyPenalty: false,
      presencePenalty: false,
      maxTokens: true,
      stop: true,
      seed: true,
      stream: true,
      systemPrompt: true,
    },
    needsBaseUrl: false,
    needsApiKey: true,
    defaultModels: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000 },
      { id: 'pixtral-large-latest', name: 'Pixtral Large', contextWindow: 128000 },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32768 },
    ],
    builtin: false,
  },
  together: {
    label: 'Together AI',
    description: 'Fast cloud hosting for open-weights models (Llama, Qwen, DeepSeek). Key from together.ai.',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyUrl: 'https://api.together.ai/settings/api-keys',
    capabilities: {
      temperature: true,
      topP: true,
      topK: true,
      minP: false,
      repetitionPenalty: true,
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
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', contextWindow: 131072 },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', contextWindow: 32768 },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', contextWindow: 163840 },
    ],
    builtin: false,
  },
  perplexity: {
    label: 'Perplexity AI',
    description: 'Search & reasoning LLMs via official Perplexity API. Key from perplexity.ai.',
    baseUrl: 'https://api.perplexity.ai',
    apiKeyUrl: 'https://www.perplexity.ai/settings/api',
    capabilities: {
      temperature: true,
      topP: true,
      topK: false,
      minP: false,
      repetitionPenalty: true,
      frequencyPenalty: true,
      presencePenalty: true,
      maxTokens: true,
      stop: true,
      seed: false,
      stream: true,
      systemPrompt: true,
    },
    needsBaseUrl: false,
    needsApiKey: true,
    defaultModels: [
      { id: 'sonar-pro', name: 'Sonar Pro (Search)', contextWindow: 200000 },
      { id: 'sonar', name: 'Sonar', contextWindow: 128000 },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', contextWindow: 128000 },
    ],
    builtin: false,
  },
  'openai-compatible': {
    label: 'OpenAI-Compatible / Custom',
    description: 'Connect any OpenAI-compatible server (LM Studio, Ollama, vLLM, LocalAI, Jan, text-generation-webui).',
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
      { id: 'llama3.2', name: 'Llama 3.2 (Ollama)', contextWindow: 131072 },
      { id: 'mistral-7b-instruct', name: 'Mistral 7B', contextWindow: 32768 },
    ],
    builtin: false,
  },
  zai: {
    label: 'Legacy Cloud Provider',
    description: 'Legacy provider support.',
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
  // Reasoning models (DeepSeek R1, GPT-OSS, Qwen3) spend tokens on
  // chain-of-thought BEFORE producing visible content. 512 was too low —
  // the model would exhaust its budget mid-reasoning and return an empty
  // message. 2048 gives reasoning models room to finish AND write a reply.
  maxTokens: 2048,
  stop: [],
  seed: undefined,
  stream: true,
}

export const DEFAULT_PROMPT_SETTINGS = {
  contextSize: 8192,
  maxResponseTokens: 2048,
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
    genParams: { temperature: 1.1, topP: 0.95, maxTokens: 2048, stream: true },
    promptSettings: { contextSize: 8192, maxResponseTokens: 2048, recentMessages: 24 },
  },
  {
    name: 'Balanced',
    description: 'A sensible default for general roleplay and conversation.',
    genParams: { temperature: 0.9, topP: 1, maxTokens: 2048, stream: true },
    promptSettings: { contextSize: 8192, maxResponseTokens: 2048, recentMessages: 20 },
  },
  {
    name: 'Precise',
    description: 'Lower temperature for coherent, on-task responses.',
    genParams: { temperature: 0.5, topP: 0.8, maxTokens: 2048, stream: true },
    promptSettings: { contextSize: 8192, maxResponseTokens: 2048, recentMessages: 16 },
  },
  {
    name: 'Long-form',
    description: 'Longer responses for narrative and story-driven roleplay.',
    genParams: { temperature: 0.95, topP: 0.98, maxTokens: 4096, stream: true },
    promptSettings: { contextSize: 16384, maxResponseTokens: 4096, recentMessages: 30 },
  },
]

// Approximate token counter (4 chars ≈ 1 token). Good enough for budgeting.
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Detect whether a model ID refers to a "reasoning" model — i.e. one that
 * emits chain-of-thought in `delta.reasoning_content` (or similar) BEFORE
 * producing visible content. These models are slower and often produce
 * empty messages when max_tokens is too low, so we warn users in the UI.
 *
 * Patterns matched (case-insensitive, against the model id):
 *  - deepseek-r1, deepseek-reasoner
 *  - o1, o3, o4 (OpenAI reasoning family)
 *  - gpt-oss (OpenAI open-weight reasoning models on Groq)
 *  - qwen3- (Qwen 3 thinking models — note: thinking can be disabled,
 *    but we still warn since the default is thinking-on)
 *  - anything containing "reason", "reasoner", "thinking"
 *
 * Instruct models (llama-3.3, mixtral, gpt-4o, gemini-2.5, etc.) are NOT
 * reasoning models and return content normally in `delta.content`.
 */
export function isReasoningModel(modelId: string | null | undefined): boolean {
  if (!modelId) return false
  const id = modelId.toLowerCase()
  // Substring matches (catches both bare ids and provider-prefixed ids like
  // "openai/gpt-oss-120b" or "deepseek/deepseek-r1")
  if (id.includes('gpt-oss')) return true
  if (id.includes('deepseek-r1')) return true
  if (id.includes('deepseek-reasoner')) return true
  if (id.includes('qwen3')) return true
  if (id.includes('sonar-reasoning')) return true
  // OpenAI o-series reasoning models (o1, o3, o4 — but not "o1enai" etc.)
  // Match either at start of string or after a "/"
  if (/(^|\/)o[134](\b|-|$)/.test(id)) return true
  // Generic reasoning labels
  if (id.includes('reason')) return true
  if (id.includes('thinking')) return true
  return false
}

/**
 * Human-readable advice shown to users when they pick a reasoning model.
 * Used by the API Manager banner.
 */
export function reasoningModelAdvice(modelId: string): string {
  return `This is a reasoning model — it produces chain-of-thought before its reply, which is slower and consumes more tokens. For character roleplay and chat, an instruct model (like llama-3.3-70b, gpt-4o, gemini-2.5-flash) is usually faster and more directly in-character. Reasoning models are great for logic, math, and complex analysis — not so much for flowing dialogue.`
}
