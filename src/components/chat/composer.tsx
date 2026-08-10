'use client'

import { useRef, useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, Square, RefreshCw, CornerDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ComposerProps {
  onSend: (text: string) => void
  onStop: () => void
  streaming: boolean
  disabled?: boolean
  placeholder?: string
  sendMode?: 'enter' | 'ctrl-enter'
}

export function Composer({ onSend, onStop, streaming, disabled, placeholder, sendMode = 'enter' }: ComposerProps) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }, [value])

  const submit = () => {
    const v = value.trim()
    if (!v || streaming || disabled) return
    onSend(v)
    setValue('')
  }

  return (
    <div className="border-t bg-background/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (sendMode === 'enter') {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              } else {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  submit()
                }
              }
            }}
            placeholder={placeholder || 'Write a message…  (Enter to send, Shift+Enter for newline)'}
            disabled={disabled}
            className={cn(
              'min-h-[44px] resize-none pr-24 text-sm',
              'max-h-[240px]',
            )}
            rows={1}
          />
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
            {streaming ? (
              <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={onStop}>
                <Square className="h-3.5 w-3.5 fill-current" /> Stop
              </Button>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="h-8 gap-1.5" onClick={submit} disabled={disabled || !value.trim()}>
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enter</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>Press <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd> to send</span>
        <span>Character replies as the AI · Data stays local</span>
      </div>
    </div>
  )
}
