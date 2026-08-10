import 'server-only'
import ZAI from 'z-ai-web-dev-sdk'
import type {
  ChatMessageInput,
  GenParams,
  ProviderType,
} from './types'

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
 * Generate a completion (streaming). The Z.AI Cloud provider uses
 * z-ai-web-dev-sdk; other providers issue OpenAI-compatible HTTP requests
 * against a user-supplied base URL / API key.
 */
export async function streamGenerate(
  opts: GenerateOptions,
  cb: StreamCallbacks,
): Promise<void> {
  const start = Date.now()
  try {
    if (opts.provider === 'zai') {
      await streamZai(opts, cb, start)
    } else {
      await streamOpenAICompatible(opts, cb, start)
    }
  } catch (err) {
    cb.onError(err as Error)
  }
}

async function streamZai(
  opts: GenerateOptions,
  cb: StreamCallbacks,
  start: number,
) {
  const zai = await ZAI.create()
  const model = opts.model || 'glm-4.6'

  // The Z.AI GLM endpoint rejects the 'system' role when followed by an
  // 'assistant' message (e.g. [system, assistant(greeting), user] → 400
  // "messages 参数非法"). The SDK's documented usage places the system
  // directive in an 'assistant' message. We remap 'system'→'assistant' and
  // merge consecutive same-role messages, inserting a clear delimiter when
  // the system context is merged with a greeting so the model understands the
  // greeting is its opening line (not a turn to repeat) and responds to the
  // latest user message instead.
  const remapped = opts.messages.map((m) => ({
    role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
    content: m.content,
  }))
  const merged: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of remapped) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) {
      // Delimit system-context + greeting so the model treats the greeting as
      // its opening line, not a turn to continue/repeat.
      const sep = last.role === 'assistant' && !last.content.includes('--- (Scene opening) ---')
        ? '\n\n--- (Scene opening — your first message) ---\n'
        : '\n\n'
      last.content += sep + m.content
    } else {
      merged.push({ ...m })
    }
  }
  // Drop any empty messages that could invalidate the request.
  const cleaned = merged.filter((m) => m.content && m.content.trim().length > 0)

  // The SDK returns a raw ReadableStream (SSE bytes) when stream:true.
  const streamBody: any = await (zai.chat.completions as any).create({
    model,
    messages: cleaned,
    stream: true,
    temperature: opts.params.temperature,
    top_p: opts.params.topP,
    thinking: { type: 'disabled' },
  })

  let full = ''
  if (streamBody && typeof streamBody.getReader === 'function') {
    const reader = streamBody.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      if (opts.signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue
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
          // partial json — ignore
        }
      }
    }
  }
  cb.onDone(full, {
    tokens: Math.ceil(full.length / 4),
    model,
    provider: 'zai',
    latencyMs: Date.now() - start,
  })
}

/**
 * OpenAI-compatible streaming (also used for real OpenAI/Anthropic via
 * their OpenAI-compatible endpoints where available; for Anthropic we fall
 * back to the Messages API shape). For simplicity and to avoid pulling in
 * provider SDKs, we use fetch with SSE parsing.
 */
async function streamOpenAICompatible(
  opts: GenerateOptions,
  cb: StreamCallbacks,
  start: number,
) {
  const base =
    opts.provider === 'openai'
      ? 'https://api.openai.com/v1'
      : opts.provider === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : (opts.baseUrl || 'http://localhost:1234/v1').replace(/\/$/, '')

  const model = opts.model || 'gpt-4o-mini'

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.apiKey
        ? { Authorization: `Bearer ${opts.apiKey}` }
        : {}),
      ...(opts.provider === 'anthropic'
        ? { 'anthropic-version': '2023-06-01' }
        : {}),
    },
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

/** Non-streaming connection test for the API Manager. */
export async function testConnection(opts: {
  provider: ProviderType
  baseUrl?: string
  apiKey?: string
  model?: string
}): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    if (opts.provider === 'zai') {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'You reply with exactly: OK' },
          { role: 'user', content: 'ping' },
        ],
        thinking: { type: 'disabled' },
      })
      const text = completion.choices?.[0]?.message?.content || ''
      return { ok: true, message: `Connected — model replied "${text.slice(0, 40)}"`, model: opts.model || 'glm-4.6' }
    }
    const base =
      opts.provider === 'openai'
        ? 'https://api.openai.com/v1'
        : opts.provider === 'anthropic'
          ? 'https://api.anthropic.com/v1'
          : (opts.baseUrl || 'http://localhost:1234/v1').replace(/\/$/, '')
    const res = await fetch(`${base}/models`, {
      headers: opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {},
    })
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` }
    }
    return { ok: true, message: 'Connection successful.', model: opts.model }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
