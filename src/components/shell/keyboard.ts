'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

export function useKeyboardShortcuts() {
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const setView = useAppStore((s) => s.setView)
  const toggleFocus = useAppStore((s) => s.toggleFocus)
  const toggleLeft = useAppStore((s) => s.toggleLeft)
  const toggleRight = useAppStore((s) => s.toggleRight)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) {
        // Escape closes command palette
        if (e.key === 'Escape') {
          useAppStore.getState().setCommandOpen(false)
        }
        return
      }

      // Command palette
      if (e.key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
        return
      }
      // Focus mode
      if (e.key === '.') {
        e.preventDefault()
        toggleFocus()
        return
      }
      if (e.key === '\\') {
        e.preventDefault()
        toggleLeft()
        return
      }
      if (e.key === 'b' && e.shiftKey) {
        e.preventDefault()
        toggleRight()
        return
      }

      // View switching ⌘1..7
      const viewMap: Record<string, any> = {
        '1': 'chat',
        '2': 'characters',
        '3': 'personas',
        '4': 'lorebooks',
        '5': 'presets',
        '6': 'api',
        '7': 'settings',
      }
      if (viewMap[e.key]) {
        e.preventDefault()
        setView(viewMap[e.key])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandOpen, setView, toggleFocus, toggleLeft, toggleRight])
}
