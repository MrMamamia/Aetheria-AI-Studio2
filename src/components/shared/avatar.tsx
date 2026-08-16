'use client'

import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
}

// Deterministic gradient from name for fallback avatars.
function gradientFor(name: string) {
  const palettes = [
    'from-emerald-400 to-teal-600',
    'from-amber-400 to-orange-600',
    'from-rose-400 to-pink-600',
    'from-violet-400 to-purple-600',
    'from-cyan-400 to-blue-500',
    'from-lime-400 to-green-600',
    'from-fuchsia-400 to-pink-600',
    'from-yellow-400 to-amber-600',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return palettes[h % palettes.length]
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-semibold text-white',
        SIZES[size],
        !src && `bg-gradient-to-br ${gradientFor(name || '?')}`,
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials || '?'}</span>
      )}
    </div>
  )
}
