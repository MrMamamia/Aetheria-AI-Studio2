'use client'

import { useAppStore } from '@/lib/store'
import { NAV_GROUPS } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PanelLeftClose, PanelLeftOpen, Sparkle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export function NavRail() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const leftCollapsed = useAppStore((s) => s.leftCollapsed)
  const toggleLeft = useAppStore((s) => s.toggleLeft)

  return (
    <div className="flex h-full flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className={cn(
        'flex h-14 items-center gap-2 border-b px-3',
        leftCollapsed && 'justify-center px-0',
      )}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkle className="h-4 w-4" />
        </div>
        {!leftCollapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">Aetheria</span>
            <span className="text-[10px] text-muted-foreground">Character Studio</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <TooltipProvider delayDuration={200}>
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-4 p-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.group} className="flex flex-col gap-0.5">
                {!leftCollapsed && (
                  <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = view === item.id
                  const button = (
                    <Button
                      key={item.id}
                      variant={active ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setView(item.id)}
                      className={cn(
                        'h-9 w-full justify-start gap-2.5 font-medium',
                        leftCollapsed && 'h-9 w-9 justify-center px-0',
                        active && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                      {!leftCollapsed && <span className="truncate">{item.label}</span>}
                    </Button>
                  )
                  return leftCollapsed ? (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                        {item.shortcut && (
                          <span className="ml-2 text-xs text-muted-foreground">{item.shortcut}</span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    button
                  )
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>
      </TooltipProvider>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLeft}
          className="h-9 w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground"
        >
          {leftCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
