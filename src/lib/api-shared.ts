// Shared helpers for API routes.

/** Parse a JSON string field safely. Returns fallback on error. */
export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/** Parse a JSON string array. Always returns a string[]. */
export function parseStringArray(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    if (Array.isArray(v)) return v.map(String)
    return []
  } catch {
    return []
  }
}

/** Stringify a value for JSON storage. */
export function stringifyJson(v: unknown): string {
  return JSON.stringify(v)
}

/** Strip the apiKey field from an ApiProfile object and add `hasKey`. */
export function stripApiKey<T extends { apiKey?: string | null }>(
  profile: T,
): Omit<T, 'apiKey'> & { hasKey: boolean } {
  const { apiKey: _omit, ...rest } = profile
  return { ...rest, hasKey: Boolean(_omit) }
}

import type { Message } from '@prisma/client'

/**
 * Build the linear "active timeline" of messages for a chat.
 * Walks from root messages following each message's `activeChildId`.
 * Returns messages in chronological order (root → leaf).
 */
export function buildActiveTimeline(messages: Message[]): Message[] {
  const byId = new Map<string, Message>()
  const roots: Message[] = []
  for (const m of messages) {
    byId.set(m.id, m)
    if (!m.parentId) roots.push(m)
  }
  roots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const timeline: Message[] = []
  for (const root of roots) {
    let cur: Message | undefined = root
    const visited = new Set<string>()
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id)
      timeline.push(cur)
      cur = cur.activeChildId ? byId.get(cur.activeChildId) : undefined
    }
  }
  return timeline
}
