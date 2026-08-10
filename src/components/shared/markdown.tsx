'use client'

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

// Minimal, safe markdown renderer for chat messages.
// Wraps *action* and "speech" styling via the prose-chat CSS.
export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn('prose-chat', className)}>
      <ReactMarkdown
        components={{
          // Render links safely
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline" />
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}
