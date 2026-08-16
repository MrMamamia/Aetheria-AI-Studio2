'use client'

import { useEffect } from 'react'
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable'
import { NavRail } from '@/components/shell/nav-rail'
import { Header } from '@/components/shell/header'
import { Inspector } from '@/components/shell/inspector'
import { CommandPalette } from '@/components/shell/command-palette'
import { Workspace } from '@/components/shell/workspace'
import { useAppStore } from '@/lib/store'
import { useKeyboardShortcuts } from '@/components/shell/keyboard'

export function AppShell() {
  const leftCollapsed = useAppStore((s) => s.leftCollapsed)
  const rightCollapsed = useAppStore((s) => s.rightCollapsed)
  const focusMode = useAppStore((s) => s.focusMode)
  const view = useAppStore((s) => s.view)

  useKeyboardShortcuts()

  // Seed on first load
  useEffect(() => {
    fetch('/api/seed', { method: 'POST' }).then(() => {
      window.dispatchEvent(new CustomEvent('aetheria:seeded'))
    }).catch(() => {})
  }, [])

  const showRight = !focusMode && !rightCollapsed && view === 'chat'
  const centerDefault = focusMode ? 100 : showRight ? 60 : leftCollapsed ? 92 : 84

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="flex-1" autoSaveId="aetheria-layout">
        {!focusMode && (
          <>
            <ResizablePanel
              defaultSize={leftCollapsed ? 4 : 16}
              minSize={leftCollapsed ? 3.5 : 12}
              maxSize={leftCollapsed ? 5 : 22}
              collapsible
              collapsedSize={4}
              id="nav"
              order={1}
            >
              <NavRail />
            </ResizablePanel>
            <ResizableHandle withHandle={!leftCollapsed} />
          </>
        )}

        <ResizablePanel defaultSize={centerDefault} minSize={30} id="workspace" order={2}>
          <div className="flex h-full flex-col">
            {!focusMode && <Header />}
            <main className="flex-1 overflow-hidden">
              <Workspace />
            </main>
          </div>
        </ResizablePanel>

        {showRight && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={24} minSize={18} maxSize={40} collapsible id="inspector" order={3}>
              <Inspector />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <CommandPalette />
    </div>
  )
}
