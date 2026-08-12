'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Command, Focus, PanelRight, Search, Moon, Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { NAV_GROUPS } from '@/lib/nav'

export function Header() {
  const view = useAppStore((s) => s.view)
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const toggleRight = useAppStore((s) => s.toggleRight)
  const rightCollapsed = useAppStore((s) => s.rightCollapsed)
  const toggleFocus = useAppStore((s) => s.toggleFocus)

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Detect mount to avoid hydration mismatch with next-themes.
  // setState-in-effect is the canonical pattern here; suppress the rule.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const currentNav = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === view)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{currentNav?.label ?? 'Aetheria'}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-muted-foreground"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search</span>
          <kbd className="ml-1 hidden items-center gap-0.5 rounded border bg-muted px-1 text-[10px] font-medium md:inline-flex">
            ⌘K
          </kbd>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {view === 'chat' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleRight}
            title="Toggle inspector"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleFocus}
          title="Focus mode"
        >
          <Focus className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
