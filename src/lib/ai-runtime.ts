import 'server-only'
import { PROVIDERS } from './providers'
import type { ChatMessageInput, GenParams, ProviderType } from './types'

export interface GenerateOptions {
  provider: ProviderType
  baseUrl?: string
  apiKey?: string
  model?: string
  messages: ChatMessageInput[]
  params: GenParams
  signal?: AbortSignal
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (full: string, meta: StreamMeta) => void
  onError: (err: Error) => void
}

export interface StreamMeta {
  tokens: number
  model?: string
  provider: ProviderType
  latencyMs: number
}

/**
 * Generate a completion (streaming). Uses OpenAI-compatible HTTP endpoints
 * supported by OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, DeepSeek,
 * Mistral, Together AI, Perplexity, and local OpenAI-compatible servers.
 */
export async function streamGenerate(
  opts: GenerateOptions,
  cb: StreamCallbacks,
): Promise<void> {
  const start = Date.now()
  try {
    await streamOpenAICompatible(opts, cb, start)
  } catch (err) {
    cb.onError(err as Error)
  }
}

async function streamOpenAICompatible(
  opts: GenerateOptions,
  cb: StreamCallbacks,
  start: number,
) {
  const providerMeta = PROVIDERS[opts.provider]
  const base = (
    opts.baseUrl ||
    providerMeta?.baseUrl ||
    'https://api.openai.com/v1'
  ).replace(/\/$/, '')

  const defaultModel = providerMeta?.defaultModels?.[0]?.id || 'gpt-4o'
  const model = opts.model || defaultModel

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (opts.apiKey) {
    headers.Authorization = `Bearer ${opts.apiKey}`
  }

  if (opts.provider === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01'
  } else if (opts.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://aetheria-studio.app'
    headers['X-Title'] = 'Aetheria Studio'
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: opts.messages,
      stream: true,
      temperature: opts.params.temperature,
      top_p: opts.params.topP,
      max_tokens: opts.params.maxTokens,
      stop: opts.params.stop?.length ? opts.params.stop : undefined,
      frequency_penalty: opts.params.frequencyPenalty,
      presence_penalty: opts.params.presencePenalty,
      seed: opts.params.seed,
    }),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Provider error ${res.status}: ${text.slice(0, 300) || res.statusText}`,
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta: string =
          json?.choices?.[0]?.delta?.content ??
          json?.choices?.[0]?.message?.content ??
          ''
        if (delta) {
          full += delta
          cb.onToken(delta)
        }
      } catch {
        // ignore partial json
      }
    }
  }

  cb.onDone(full, {
    tokens: Math.ceil(full.length / 4),
    model,
    provider: opts.provider,
    latencyMs: Date.now() - start,
  })
}

/**
 * Fetch the available model IDs from an OpenAI-compatible `/models` endpoint.
 * Returns an empty array when the provider doesn't expose one.
 */
export async function listModels(opts: {
  provider: ProviderType
  baseUrl?: string
  apiKey?: string
}): Promise<string[]> {
  try {
    const providerMeta = PROVIDERS[opts.provider]
    const base = (
      opts.baseUrl ||
      providerMeta?.baseUrl ||
      'https://api.openai.com/v1'
    ).replace(/\/$/, '')

    const headers: Record<string, string> = {}
    if (opts.apiKey) {
      headers.Authorization = `Bearer ${opts.apiKey}`
    }
    if (opts.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://aetheria-studio.app'
      headers['X-Title'] = 'Aetheria Studio'
    }

    const res = await fetch(`${base}/models`, { headers })
    if (!res.ok) return []
    const json = await res.json().catch(() => null)
    const data = json?.data
    if (!Array.isArray(data)) return []
    return data
      .map((m: { id?: string }) => m?.id)
      .filter((id: string | undefined): id is string => Boolean(id))
  } catch {
    return []
  }
}

/** Non-streaming connection test for the API Manager. */
export async function testConnection(opts: {
  provider: ProviderType
  baseUrl?: string
  apiKey?: string
  model?: string
}): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const providerMeta = PROVIDERS[opts.provider]
    const base = (
      opts.baseUrl ||
      providerMeta?.baseUrl ||
      'https://api.openai.com/v1'
    ).replace(/\/$/, '')

    const headers: Record<string, string> = {}
    if (opts.apiKey) {
      headers.Authorization = `Bearer ${opts.apiKey}`
    }
    if (opts.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://aetheria-studio.app'
      headers['X-Title'] = 'Aetheria Studio'
    }

    const res = await fetch(`${base}/models`, { headers })
    if (!res.ok) {
      // Fall back to a lightweight chat completion ping if /models returns 404/405
      const pingRes = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          model: opts.model || providerMeta?.defaultModels?.[0]?.id || 'gpt-4o',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      })

      if (pingRes.ok) {
        return {
          ok: true,
          message: 'Connection successful (verified via completion ping).',
          model: opts.model,
        }
      }

      return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` }
    }
    return { ok: true, message: 'Connection successful.', model: opts.model }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
