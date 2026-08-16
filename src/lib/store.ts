'use client'

import { create } from 'zustand'
import type { View } from './types'

interface AppState {
  // Navigation
  view: View
  setView: (v: View) => void

  // Selected entities
  activeCharacterId: string | null
  activeChatId: string | null
  activePersonaId: string | null
  editingCharacterId: string | null

  setActiveCharacter: (id: string | null) => void
  setActiveChat: (id: string | null) => void
  setActivePersona: (id: string | null) => void
  setEditingCharacter: (id: string | null) => void

  // Panel layout
  leftCollapsed: boolean
  rightCollapsed: boolean
  focusMode: boolean
  toggleLeft: () => void
  toggleRight: () => void
  toggleFocus: () => void

  // Inspector tab within right panel (when in chat view)
  inspectorTab: 'character' | 'context' | 'generation' | 'memory' | 'debug'
  setInspectorTab: (t: AppState['inspectorTab']) => void

  // Command palette
  commandOpen: boolean
  setCommandOpen: (o: boolean) => void

  // Streaming state
  isGenerating: boolean
  setGenerating: (g: boolean) => void

  // Last built context (for prompt inspector)
  lastContext: any | null
  setLastContext: (c: any | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'characters',
  setView: (view) => set({ view }),

  activeCharacterId: null,
  activeChatId: null,
  activePersonaId: null,
  editingCharacterId: null,

  setActiveCharacter: (activeCharacterId) => set({ activeCharacterId }),
  setActiveChat: (activeChatId) => set({ activeChatId }),
  setActivePersona: (activePersonaId) => set({ activePersonaId }),
  setEditingCharacter: (editingCharacterId) =>
    set({ editingCharacterId, view: editingCharacterId ? 'character-editor' : 'characters' }),

  leftCollapsed: false,
  rightCollapsed: false,
  focusMode: false,
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode, rightCollapsed: !s.focusMode ? true : s.rightCollapsed })),

  inspectorTab: 'character',
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),

  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  isGenerating: false,
  setGenerating: (isGenerating) => set({ isGenerating }),

  lastContext: null,
  setLastContext: (lastContext) => set({ lastContext }),
}))
