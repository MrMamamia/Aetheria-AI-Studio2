'use client'

import { useState } from 'react'
import type { ChatMessage } from './use-chat'
import { Avatar } from '@/components/shared/avatar'
import { Markdown } from '@/components/shared/markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { api } from '@/hooks/use-fetch'
import { toast } from 'sonner'
import {
  Copy, Pencil, RefreshCw, GitBranch, Trash2, Check, X, ChevronLeft,
  ChevronRight, ChevronDown, Pin, Star, CornerDownRight, Brain,
} from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface MessageItemProps {
  message: ChatMessage
  character: any
  isStreaming?: boolean
  streamingContent?: string
  streamingReasoning?: string
  onRegenerate?: () => void
  onContinue?: () => void
  onBranch?: () => void
  onChanged?: () => void
  isLast?: boolean
  showTokenCounts?: boolean
}

export function MessageItem({
  message,
  character,
  isStreaming,
  streamingContent,
  streamingReasoning,
  onRegenerate,
  onContinue,
  onBranch,
  onChanged,
  isLast,
  showTokenCounts,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showReasoning, setShowReasoning] = useState(false)
  const isUser = message.role === 'user'
  const content = isStreaming ? (streamingContent || '') : message.content
  const reasoning = isStreaming ? (streamingReasoning || '') : (message.reasoning || '')

  const copy = () => {
    navigator.clipboard.writeText(message.content)
    toast.success('Copied to clipboard')
  }

  const saveEdit = async () => {
    try {
      await api(`/api/messages/${message.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent }),
      })
      setEditing(false)
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const del = async () => {
    try {
      await api(`/api/messages/${message.id}`, { method: 'DELETE' })
      onChanged?.()
      toast.success('Message deleted')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const togglePin = async () => {
    try {
      await api(`/api/messages/${message.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isPinned: !message.isPinned }),
      })
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const toggleImportant = async () => {
    try {
      await api(`/api/messages/${message.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isImportant: !message.isImportant }),
      })
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Swipe navigation (alternative generations)
  const swipeCount = message.swipes?.length || 0
  const hasSwipes = swipeCount > 1
  const goSwipe = async (dir: -1 | 1) => {
    if (!hasSwipes) return
    const next = (message.swipeIndex + dir + swipeCount) % swipeCount
    try {
      await api(`/api/messages/${message.id}`, {
        method: 'PUT',
        body: JSON.stringify({ swipeIndex: next }),
      })
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'group relative anim-fade-in',
            'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30',
            isUser && 'flex-row-reverse',
          )}
        >
          {/* Avatar */}
          <div className="pt-0.5">
            {isUser ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <span className="text-xs font-semibold">You</span>
              </div>
            ) : (
              <Avatar name={character?.name || 'AI'} src={character?.avatar} size="md" />
            )}
          </div>

          {/* Bubble */}
          <div className={cn('flex min-w-0 max-w-[80%] flex-col', isUser ? 'items-end' : 'items-start')}>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {isUser ? 'You' : character?.name || 'Character'}
              </span>
              {message.model && !isUser && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{message.model}</span>
              )}
              {message.isPinned && <Pin className="h-3 w-3 text-primary" />}
              {message.isImportant && <Star className="h-3 w-3 text-amber-500" />}
            </div>

            {editing ? (
              <div className="w-full space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={Math.min(12, editContent.split('\n').length + 1)}
                  className="text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 gap-1.5" onClick={saveEdit}>
                    <Check className="h-3.5 w-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => setEditing(false)}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-2">
                {/* Reasoning / thinking block (collapsible) */}
                {reasoning && !isUser && (
                  <div className="mb-1 rounded-lg border border-dashed bg-muted/40">
                    <button
                      type="button"
                      onClick={() => setShowReasoning((v) => !v)}
                      className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Brain className="h-3 w-3" />
                      {isStreaming ? 'Thinking…' : 'Reasoning'}
                      <ChevronDown
                        className={cn('ml-auto h-3 w-3 transition-transform', showReasoning && 'rotate-180')}
                      />
                    </button>
                    {showReasoning && (
                      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-t border-dashed px-2.5 py-2 text-[11px] text-muted-foreground">
                        {reasoning}
                      </div>
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-sm',
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-card border rounded-tl-sm',
                    isStreaming && 'stream-caret',
                  )}
                >
                  {content ? (
                    <Markdown content={content} />
                  ) : isStreaming ? (
                    <span className="text-muted-foreground">
                      {reasoning ? 'Composing response…' : 'Thinking…'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Empty message</span>
                  )}
                </div>
              </div>
            )}

            {/* Swipe navigation */}
            {hasSwipes && !editing && !isStreaming && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => goSwipe(-1)}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="font-mono">{message.swipeIndex + 1}/{swipeCount}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => goSwipe(1)}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Token / latency footer */}
            {showTokenCounts && !isStreaming && (message.tokens || message.latencyMs) && (
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                {message.tokens && <span>{message.tokens} tok</span>}
                {message.latencyMs && <span>· {message.latencyMs}ms</span>}
              </div>
            )}

            {/* Hover controls */}
            {!editing && !isStreaming && (
              <div
                className={cn(
                  'absolute top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                  isUser ? 'left-2' : 'right-2',
                )}
              >
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur" onClick={copy}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur" onClick={() => { setEditContent(message.content); setEditing(true) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  {!isUser && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur" onClick={onRegenerate}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Regenerate</TooltipContent>
                    </Tooltip>
                  )}
                  {!isUser && isLast && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur" onClick={onContinue}>
                          <CornerDownRight className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Continue</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur" onClick={onBranch}>
                        <GitBranch className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Branch from here</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur text-destructive hover:text-destructive" onClick={del}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={copy}><Copy className="mr-2 h-4 w-4" /> Copy</ContextMenuItem>
        <ContextMenuItem onClick={() => { setEditContent(message.content); setEditing(true) }}><Pencil className="mr-2 h-4 w-4" /> Edit</ContextMenuItem>
        {!isUser && <ContextMenuItem onClick={onRegenerate}><RefreshCw className="mr-2 h-4 w-4" /> Regenerate</ContextMenuItem>}
        {!isUser && isLast && <ContextMenuItem onClick={onContinue}><CornerDownRight className="mr-2 h-4 w-4" /> Continue</ContextMenuItem>}
        <ContextMenuItem onClick={onBranch}><GitBranch className="mr-2 h-4 w-4" /> Branch from here</ContextMenuItem>
        <ContextMenuItem onClick={togglePin}><Pin className="mr-2 h-4 w-4" /> {message.isPinned ? 'Unpin' : 'Pin'}</ContextMenuItem>
        <ContextMenuItem onClick={toggleImportant}><Star className="mr-2 h-4 w-4" /> {message.isImportant ? 'Unmark important' : 'Mark important'}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive focus:text-destructive" onClick={del}><Trash2 className="mr-2 h-4 w-4" /> Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
