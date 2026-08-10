'use client'

import {
  MessageSquare, Users, BookOpen, SlidersHorizontal, KeyRound, Settings,
  Sparkles, Library, Wrench,
} from 'lucide-react'
import type { View } from '@/lib/types'
import type { LucideIcon } from 'lucide-react'

export const NAV_GROUPS: {
  group: 'workspace' | 'library' | 'system'
  label: string
  items: { id: View; label: string; icon: LucideIcon; shortcut?: string }[]
}[] = [
  {
    group: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'chat', label: 'Chat', icon: MessageSquare, shortcut: '⌘1' },
    ],
  },
  {
    group: 'library',
    label: 'Library',
    items: [
      { id: 'characters', label: 'Characters', icon: Users, shortcut: '⌘2' },
      { id: 'personas', label: 'Personas', icon: Sparkles, shortcut: '⌘3' },
      { id: 'lorebooks', label: 'Lorebooks', icon: BookOpen, shortcut: '⌘4' },
      { id: 'presets', label: 'Presets', icon: SlidersHorizontal, shortcut: '⌘5' },
    ],
  },
  {
    group: 'system',
    label: 'System',
    items: [
      { id: 'api', label: 'AI / API', icon: KeyRound, shortcut: '⌘6' },
      { id: 'settings', label: 'Settings', icon: Settings, shortcut: '⌘7' },
    ],
  },
]

export const NAV_ICON: Record<View, LucideIcon> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.icon])),
) as Record<View, LucideIcon>

export const LibraryIcon = Library
export const WrenchIcon = Wrench
