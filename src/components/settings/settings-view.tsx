'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Brain,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FlaskConical,
  Keyboard,
  Layers,
  Loader2,
  type LucideIcon,
  MessageSquare,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Users,
  Zap,
} from 'lucide-react'

import { api, useFetch } from '@/hooks/use-fetch'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ============================================================
// Types & constants
// ============================================================

type CategoryId =
  | 'general'
  | 'chat'
  | 'ai'
  | 'context'
  | 'characters'
  | 'data'
  | 'advanced'
  | 'shortcuts'

interface CategoryDef {
  id: CategoryId
  label: string
  icon: LucideIcon
  description: string
}

const CATEGORIES: CategoryDef[] = [
  { id: 'general', label: 'General', icon: SettingsIcon, description: 'Appearance & behavior' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, description: 'Conversation preferences' },
  { id: 'ai', label: 'AI', icon: Brain, description: 'Default providers & presets' },
  { id: 'context', label: 'Context', icon: Layers, description: 'Token budget & summarization' },
  { id: 'characters', label: 'Characters', icon: Users, description: 'Character defaults' },
  { id: 'data', label: 'Data', icon: Database, description: 'Backup, restore & import' },
  { id: 'advanced', label: 'Advanced', icon: FlaskConical, description: 'Debug & experimental' },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, description: 'Keyboard reference' },
]

interface Settings {
  theme: 'system' | 'light' | 'dark'
  animations: boolean
  showShortcutHints: boolean
  streaming: boolean
  autoScroll: boolean
  sendMode: 'enter' | 'ctrlEnter'
  showTokenCounts: boolean
  confirmDeleteMessage: boolean
  defaultApiProfileId: string
  defaultPresetId: string
  contextSize: number
  autoSummarize: boolean
  contextWarningThreshold: number
  defaultGreetingBehavior: 'firstMessage' | 'empty'
  autoCreateChat: boolean
  debugMode: boolean
  experimentalFeatures: boolean
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  animations: true,
  showShortcutHints: true,
  streaming: true,
  autoScroll: true,
  sendMode: 'enter',
  showTokenCounts: false,
  confirmDeleteMessage: true,
  defaultApiProfileId: '',
  defaultPresetId: '',
  contextSize: 8192,
  autoSummarize: false,
  contextWarningThreshold: 80,
  defaultGreetingBehavior: 'firstMessage',
  autoCreateChat: true,
  debugMode: false,
  experimentalFeatures: false,
}

const SAVE_DEBOUNCE_MS = 500

// ============================================================
// Backup shape
// ============================================================

interface BackupFile {
  version: number
  exportedAt: string
  characters: any[]
  personas: any[]
  lorebooks: any[]
  presets: any[]
  apiProfiles: any[]
  chats: any[]
  memory: any[]
  settings: Record<string, unknown>
}

// ============================================================
// Generic helpers
// ============================================================

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function readJSONFile<T = any>(file: File): Promise<T> {
  const text = await file.text()
  return JSON.parse(text) as T
}

function safeCoerce(
  raw: Record<string, unknown> | null | undefined,
  defaults: Settings,
): Settings {
  if (!raw || typeof raw !== 'object') return { ...defaults }
  const out: Record<string, unknown> = { ...defaults }
  // Copy known keys
  for (const k of Object.keys(defaults)) {
    const v = raw[k]
    if (v !== undefined && v !== null) {
      out[k] = v
    }
  }
  // Theme/sendMode/greeting are constrained unions — validate
  if (out.theme !== 'system' && out.theme !== 'light' && out.theme !== 'dark') {
    out.theme = defaults.theme
  }
  if (out.sendMode !== 'enter' && out.sendMode !== 'ctrlEnter') {
    out.sendMode = defaults.sendMode
  }
  if (
    out.defaultGreetingBehavior !== 'firstMessage' &&
    out.defaultGreetingBehavior !== 'empty'
  ) {
    out.defaultGreetingBehavior = defaults.defaultGreetingBehavior
  }
  // Coerce numeric fields
  out.contextSize = Number(out.contextSize) || defaults.contextSize
  out.contextWarningThreshold =
    Number(out.contextWarningThreshold) || defaults.contextWarningThreshold
  // Coerce booleans
  const boolKeys = [
    'animations',
    'showShortcutHints',
    'streaming',
    'autoScroll',
    'showTokenCounts',
    'confirmDeleteMessage',
    'autoSummarize',
    'autoCreateChat',
    'debugMode',
    'experimentalFeatures',
  ] as const
  for (const k of boolKeys) {
    if (typeof out[k] !== 'boolean') out[k] = defaults[k]
  }
  // Strings
  if (typeof out.defaultApiProfileId !== 'string') {
    out.defaultApiProfileId = defaults.defaultApiProfileId
  }
  if (typeof out.defaultPresetId !== 'string') {
    out.defaultPresetId = defaults.defaultPresetId
  }
  return out as unknown as Settings
}

// ============================================================
// Main SettingsView
// ============================================================

export function SettingsView() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general')
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const { setTheme } = useTheme()
  const setView = useAppStore((s) => s.setView)

  const dirtyRef = useRef<Set<keyof Settings>>(new Set())
  const settingsRef = useRef(settings)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep settingsRef in sync for the debounced save.
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // ---- Load settings on mount ----
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        if (cancelled) return
        setSettings(safeCoerce(data, DEFAULT_SETTINGS))
        setLoaded(true)
      })
      .catch((e: Error) => {
        toast.error('Failed to load settings', { description: e.message })
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Debounced save ----
  const persist = useCallback(() => {
    if (dirtyRef.current.size === 0) return
    const keys = Array.from(dirtyRef.current)
    dirtyRef.current.clear()
    const patch: Record<string, unknown> = {}
    for (const k of keys) patch[k] = settingsRef.current[k]
    api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }).catch(
      (e: Error) =>
        toast.error('Failed to save settings', { description: e.message }),
    )
  }, [])

  const update = useCallback(
    (key: keyof Settings, value: unknown) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      dirtyRef.current.add(key)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(persist, SAVE_DEBOUNCE_MS)
    },
    [persist],
  )

  // ---- Apply theme ----
  useEffect(() => {
    if (!loaded) return
    setTheme(settings.theme)
  }, [settings.theme, loaded, setTheme])

  // ---- Inject animations-disable stylesheet once ----
  useEffect(() => {
    if (typeof document === 'undefined') return
    const STYLE_ID = 'aetheria-animations-toggle'
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `
        body:not(.aetheria-animations) *,
        body:not(.aetheria-animations) *::before,
        body:not(.aetheria-animations) *::after {
          animation: none !important;
          transition: none !important;
        }
      `
      document.head.appendChild(style)
    }
  }, [])

  // ---- Toggle the body class based on the animations setting ----
  useEffect(() => {
    if (!loaded || typeof document === 'undefined') return
    if (settings.animations) {
      document.body.classList.add('aetheria-animations')
    } else {
      document.body.classList.remove('aetheria-animations')
    }
  }, [settings.animations, loaded])

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const activeCat = useMemo(
    () => CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0],
    [activeCategory],
  )

  return (
    <div className="flex h-full flex-col">
      {/* ---------------- Header ---------------- */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight tracking-tight">
            Settings
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Configure Aetheria to your liking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loaded ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="outline" className="gap-1 px-1.5 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Synced
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ---------------- Sidebar ---------------- */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r bg-muted/30">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-0.5 p-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const active = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground/80 hover:bg-accent/50 hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        active
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium leading-tight">
                        {cat.label}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {cat.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* ---------------- Content ---------------- */}
        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-6 p-6">
              <div className="space-y-0.5">
                <h2 className="text-lg font-semibold tracking-tight">
                  {activeCat.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeCat.description}
                </p>
              </div>
              <Separator />

              {!loaded ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {activeCategory === 'general' && (
                    <GeneralPanel settings={settings} update={update} />
                  )}
                  {activeCategory === 'chat' && (
                    <ChatPanel settings={settings} update={update} />
                  )}
                  {activeCategory === 'ai' && (
                    <AIPanel
                      settings={settings}
                      update={update}
                      onOpenApiManager={() => setView('api')}
                      onOpenPresets={() => setView('presets')}
                    />
                  )}
                  {activeCategory === 'context' && (
                    <ContextPanel settings={settings} update={update} />
                  )}
                  {activeCategory === 'characters' && (
                    <CharactersPanel settings={settings} update={update} />
                  )}
                  {activeCategory === 'data' && <DataPanel />}
                  {activeCategory === 'advanced' && (
                    <AdvancedPanel settings={settings} update={update} />
                  )}
                  {activeCategory === 'shortcuts' && <ShortcutsPanel />}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ============================================================
// Shared building blocks
// ============================================================

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-1 px-4 py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-0 py-0">
        {children}
      </CardContent>
    </Card>
  )
}

function SettingRow({
  title,
  description,
  htmlFor,
  children,
  isLast,
}: {
  title: string
  description?: string
  htmlFor?: string
  children: ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-4 py-3',
        !isLast && 'border-b',
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label htmlFor={htmlFor} className="text-sm font-medium leading-snug">
          {title}
        </Label>
        {description && (
          <p className="text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 self-center">{children}</div>
    </div>
  )
}

// ============================================================
// General panel
// ============================================================

function GeneralPanel({
  settings,
  update,
}: {
  settings: Settings
  update: (key: keyof Settings, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Appearance"
        description="Customize the visual style of the application."
      >
        <SettingRow
          title="Theme"
          description="Choose between light, dark, or system theme."
          htmlFor="setting-theme"
        >
          <Select
            value={settings.theme}
            onValueChange={(v) => update('theme', v)}
          >
            <SelectTrigger id="setting-theme" className="h-8 w-[160px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                <span className="inline-flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5" />
                  System
                </span>
              </SelectItem>
              <SelectItem value="light">
                <span className="inline-flex items-center gap-2">
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </span>
              </SelectItem>
              <SelectItem value="dark">
                <span className="inline-flex items-center gap-2">
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title="Animations"
          description="Enable smooth transitions and micro-interactions. Disable for a static, instant-feedback feel."
          htmlFor="setting-animations"
          isLast
        >
          <Switch
            id="setting-animations"
            checked={settings.animations}
            onCheckedChange={(v) => update('animations', v)}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Interface"
        description="Control what helper UI is shown across the app."
      >
        <SettingRow
          title="Keyboard shortcut hints"
          description="Show ⌘-key hints next to actions throughout the interface."
          htmlFor="setting-shortcut-hints"
          isLast
        >
          <Switch
            id="setting-shortcut-hints"
            checked={settings.showShortcutHints}
            onCheckedChange={(v) => update('showShortcutHints', v)}
          />
        </SettingRow>
      </SectionCard>
    </div>
  )
}

// ============================================================
// Chat panel
// ============================================================

function ChatPanel({
  settings,
  update,
}: {
  settings: Settings
  update: (key: keyof Settings, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Message Generation"
        description="Control how responses are streamed and displayed."
      >
        <SettingRow
          title="Streaming responses"
          description="Stream tokens as they are generated. Disable to wait for the full response."
          htmlFor="setting-streaming"
        >
          <Switch
            id="setting-streaming"
            checked={settings.streaming}
            onCheckedChange={(v) => update('streaming', v)}
          />
        </SettingRow>
        <SettingRow
          title="Auto-scroll to bottom"
          description="Automatically scroll to the latest message during generation."
          htmlFor="setting-autoscroll"
        >
          <Switch
            id="setting-autoscroll"
            checked={settings.autoScroll}
            onCheckedChange={(v) => update('autoScroll', v)}
          />
        </SettingRow>
        <SettingRow
          title="Show token counts"
          description="Display token usage under each generated message."
          htmlFor="setting-tokens"
          isLast
        >
          <Switch
            id="setting-tokens"
            checked={settings.showTokenCounts}
            onCheckedChange={(v) => update('showTokenCounts', v)}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Input Behavior"
        description="Choose how the compose box handles Enter and modifiers."
      >
        <SettingRow
          title="Send shortcut"
          description="Pick the key combination that submits a message."
          htmlFor="setting-sendmode"
        >
          <Select
            value={settings.sendMode}
            onValueChange={(v) => update('sendMode', v)}
          >
            <SelectTrigger id="setting-sendmode" className="h-8 w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enter">
                Enter to send, Shift+Enter for newline
              </SelectItem>
              <SelectItem value="ctrlEnter">
                Ctrl+Enter to send (Enter = newline)
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title="Confirm before deleting messages"
          description="Show a confirmation dialog before removing a message (and its descendants)."
          htmlFor="setting-confirm-delete"
          isLast
        >
          <Switch
            id="setting-confirm-delete"
            checked={settings.confirmDeleteMessage}
            onCheckedChange={(v) => update('confirmDeleteMessage', v)}
          />
        </SettingRow>
      </SectionCard>
    </div>
  )
}

// ============================================================
// AI panel
// ============================================================

interface ApiProfileListItem {
  id: string
  name: string
  provider: string
  hasKey: boolean
  isDefault: boolean
  modelName?: string | null
}

interface PresetListItem {
  id: string
  name: string
  description: string | null
  isDefault: boolean
}

function AIPanel({
  settings,
  update,
  onOpenApiManager,
  onOpenPresets,
}: {
  settings: Settings
  update: (key: keyof Settings, value: unknown) => void
  onOpenApiManager: () => void
  onOpenPresets: () => void
}) {
  const { data: apiProfiles } = useFetch<ApiProfileListItem[]>('/api/api-profiles')
  const { data: presets } = useFetch<PresetListItem[]>('/api/presets')

  return (
    <div className="space-y-4">
      <SectionCard
        title="Defaults"
        description="Pick which API profile and preset are pre-selected when starting a new chat."
      >
        <SettingRow
          title="Default API Profile"
          description="The provider configuration used unless overridden per chat."
          htmlFor="setting-default-api"
        >
          <Select
            value={settings.defaultApiProfileId || '__none__'}
            onValueChange={(v) =>
              update('defaultApiProfileId', v === '__none__' ? '' : v)
            }
          >
            <SelectTrigger id="setting-default-api" className="h-8 w-[220px]">
              <SelectValue placeholder="No default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">No default</span>
              </SelectItem>
              {(apiProfiles ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="inline-flex items-center gap-2">
                    {p.name}
                    {p.isDefault && (
                      <Badge
                        variant="secondary"
                        className="px-1 py-0 text-[9px]"
                      >
                        default
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title="Default Preset"
          description="The generation + prompt preset used unless overridden per chat."
          htmlFor="setting-default-preset"
          isLast
        >
          <Select
            value={settings.defaultPresetId || '__none__'}
            onValueChange={(v) =>
              update('defaultPresetId', v === '__none__' ? '' : v)
            }
          >
            <SelectTrigger id="setting-default-preset" className="h-8 w-[220px]">
              <SelectValue placeholder="No default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">No default</span>
              </SelectItem>
              {(presets ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="inline-flex items-center gap-2">
                    {p.name}
                    {p.isDefault && (
                      <Badge
                        variant="secondary"
                        className="px-1 py-0 text-[9px]"
                      >
                        default
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Manage"
        description="Open the dedicated editors to configure providers and presets."
      >
        <SettingRow title="API Manager" description="Add, edit, and test API profiles and keys." isLast>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={onOpenApiManager}
          >
            Open API Manager
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </SettingRow>
        <SettingRow
          title="Presets"
          description="Edit generation parameters and prompt settings."
          isLast
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={onOpenPresets}
          >
            Open Presets
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </SettingRow>
      </SectionCard>
    </div>
  )
}

// ============================================================
// Context panel
// ============================================================

function ContextPanel({
  settings,
  update,
}: {
  settings: Settings
  update: (key: keyof Settings, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Context Window"
        description="Configure the token budget Aetheria uses to assemble prompts."
      >
        <SettingRow
          title="Default context size"
          description="Maximum tokens reserved for the assembled context (history + system + lore + memory)."
          htmlFor="setting-context-size"
        >
          <Input
            id="setting-context-size"
            type="number"
            min={1024}
            step={1024}
            className="h-8 w-[140px]"
            value={settings.contextSize}
            onChange={(e) =>
              update('contextSize', Math.max(1024, Number(e.target.value) || 0))
            }
          />
        </SettingRow>
        <SettingRow
          title="Auto-summarize when approaching limit"
          description="When context usage crosses the warning threshold, summarize older messages into memory."
          htmlFor="setting-auto-summarize"
          isLast
        >
          <Switch
            id="setting-auto-summarize"
            checked={settings.autoSummarize}
            onCheckedChange={(v) => update('autoSummarize', v)}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Warning Threshold"
        description="Show a context-usage warning once the assembled prompt exceeds this percentage of the context window."
      >
        <div className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <Label
              htmlFor="setting-context-threshold"
              className="text-sm font-medium"
            >
              Threshold
            </Label>
            <Badge variant="secondary" className="tabular-nums">
              {settings.contextWarningThreshold}%
            </Badge>
          </div>
          <Slider
            id="setting-context-threshold"
            min={50}
            max={95}
            step={1}
            value={[settings.contextWarningThreshold]}
            onValueChange={(v) => update('contextWarningThreshold', v[0] ?? 80)}
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>50%</span>
            <span>95%</span>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ============================================================
// Characters panel
// ============================================================

function CharactersPanel({
  settings,
  update,
}: {
  settings: Settings
  update: (key: keyof Settings, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Greeting Behavior"
        description="Control how new chats with characters begin."
      >
        <SettingRow
          title="Default greeting"
          description="Whether a new chat starts with the character's first message or empty."
          htmlFor="setting-greeting"
          isLast
        >
          <Select
            value={settings.defaultGreetingBehavior}
            onValueChange={(v) => update('defaultGreetingBehavior', v)}
          >
            <SelectTrigger id="setting-greeting" className="h-8 w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="firstMessage">
                Start with first message
              </SelectItem>
              <SelectItem value="empty">Start empty</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Library Behavior"
        description="Tweak how the character library opens chats."
      >
        <SettingRow
          title="Auto-create chat on character open"
          description="When opening a character, automatically start or resume a chat. Disable to land on a character preview instead."
          htmlFor="setting-auto-create-chat"
          isLast
        >
          <Switch
            id="setting-auto-create-chat"
            checked={settings.autoCreateChat}
            onCheckedChange={(v) => update('autoCreateChat', v)}
          />
        </SettingRow>
      </SectionCard>
    </div>
  )
}

// ============================================================
// Advanced panel
// ============================================================

function AdvancedPanel({
  settings,
  update,
}: {
  settings: Settings
  update: (key: keyof Settings, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Diagnostics"
        description="Tools for inspecting and debugging prompts."
      >
        <SettingRow
          title="Debug mode"
          description="Enable the Prompt Inspector and raw request/response views in the chat inspector."
          htmlFor="setting-debug"
        >
          <Switch
            id="setting-debug"
            checked={settings.debugMode}
            onCheckedChange={(v) => update('debugMode', v)}
          />
        </SettingRow>
        <SettingRow
          title="Experimental features"
          description="Unlock unfinished or unstable features. May change or break between releases."
          htmlFor="setting-experimental"
          isLast
        >
          <Switch
            id="setting-experimental"
            checked={settings.experimentalFeatures}
            onCheckedChange={(v) => update('experimentalFeatures', v)}
          />
        </SettingRow>
      </SectionCard>

      <Card className="gap-2 bg-muted/20 py-4">
        <CardHeader className="gap-1 px-4 py-0">
          <CardTitle className="flex items-center gap-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            Developer tools
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-0">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Aetheria stores all data locally in SQLite via Prisma. API keys are
            kept on this device only — they are never sent to any server other
            than the provider you configure. Use the Data tab to back up,
            restore, or wipe your local database.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Shortcuts panel
// ============================================================

interface ShortcutDef {
  keys: string
  action: string
  group: 'Global' | 'Navigation' | 'Chat'
}

const SHORTCUTS: ShortcutDef[] = [
  { keys: '⌘K', action: 'Open command palette', group: 'Global' },
  { keys: '⌘.', action: 'Toggle focus mode', group: 'Global' },
  { keys: '⌘\\', action: 'Collapse / expand left nav rail', group: 'Global' },
  { keys: '⌘⇧B', action: 'Toggle right inspector panel', group: 'Global' },
  { keys: 'Esc', action: 'Close dialogs / command palette', group: 'Global' },
  { keys: '⌘1', action: 'Switch to Chat view', group: 'Navigation' },
  { keys: '⌘2', action: 'Switch to Characters', group: 'Navigation' },
  { keys: '⌘3', action: 'Switch to Personas', group: 'Navigation' },
  { keys: '⌘4', action: 'Switch to Lorebooks', group: 'Navigation' },
  { keys: '⌘5', action: 'Switch to Presets', group: 'Navigation' },
  { keys: '⌘6', action: 'Switch to AI / API', group: 'Navigation' },
  { keys: '⌘7', action: 'Switch to Settings', group: 'Navigation' },
  { keys: 'Enter', action: 'Send message (when Enter-to-send is enabled)', group: 'Chat' },
  { keys: 'Shift+Enter', action: 'Newline in compose (when Enter-to-send is enabled)', group: 'Chat' },
  { keys: 'Ctrl+Enter', action: 'Send message (when Ctrl-Enter-to-send is enabled)', group: 'Chat' },
]

function ShortcutsPanel() {
  const groups = useMemo(() => {
    const map = new Map<ShortcutDef['group'], ShortcutDef[]>()
    for (const s of SHORTCUTS) {
      if (!map.has(s.group)) map.set(s.group, [])
      map.get(s.group)!.push(s)
    }
    return Array.from(map.entries())
  }, [])

  return (
    <div className="space-y-4">
      <SectionCard
        title="Keyboard Shortcuts"
        description="Aetheria is built for keyboard-first navigation. ⌘ = Cmd on macOS, Ctrl on Windows/Linux."
      >
        <div className="px-4 py-3">
          <div className="space-y-5">
            {groups.map(([group, items]) => (
              <div key={group} className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className="h-8 text-[11px] uppercase tracking-wider">
                        Shortcut
                      </TableHead>
                      <TableHead className="h-8 text-[11px] uppercase tracking-wider">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((s) => (
                      <TableRow key={s.keys + s.action} className="border-border/40">
                        <TableCell className="py-2">
                          <kbd className="inline-flex h-6 min-w-7 items-center justify-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium">
                            {s.keys}
                          </kbd>
                        </TableCell>
                        <TableCell className="py-2 text-sm text-foreground/90">
                          {s.action}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ============================================================
// Data panel — backup, restore, import, export, clear
// ============================================================

function DataPanel() {
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressTitle, setProgressTitle] = useState('')
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [progressValue, setProgressValue] = useState(0)
  const [progressRunning, setProgressRunning] = useState(false)

  const [restoreOpen, setRestoreOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearConfirm, setClearConfirm] = useState('')

  const restoreInputRef = useRef<HTMLInputElement>(null)
  const importCardInputRef = useRef<HTMLInputElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // ---- Progress helpers ----

  const appendLog = useCallback((line: string) => {
    setProgressLog((prev) => [...prev, line])
  }, [])

  const startProgress = useCallback(
    (title: string) => {
      setProgressTitle(title)
      setProgressLog([])
      setProgressValue(0)
      setProgressRunning(true)
      setProgressOpen(true)
    },
    [],
  )

  const finishProgress = useCallback(
    (ok: boolean, summary?: string) => {
      setProgressRunning(false)
      setProgressValue(100)
      appendLog(ok ? '✓ Done.' : '✗ Completed with errors.')
      if (summary) appendLog(summary)
      if (ok) toast.success('Operation complete')
      else toast.error('Completed with errors — see log')
    },
    [appendLog],
  )

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [progressLog])

  // ---- Export backup ----
  const handleExportBackup = useCallback(async () => {
    startProgress('Exporting backup')
    try {
      appendLog('Fetching data…')
      const [
        characters,
        personas,
        lorebooks,
        presets,
        apiProfiles,
        chats,
        memory,
        settings,
      ] = await Promise.all([
        fetch('/api/characters').then((r) => r.json()),
        fetch('/api/personas').then((r) => r.json()),
        fetch('/api/lorebooks').then((r) => r.json()),
        fetch('/api/presets').then((r) => r.json()),
        fetch('/api/api-profiles').then((r) => r.json()),
        fetch('/api/chats').then((r) => r.json()),
        fetch('/api/memory').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ])
      appendLog(
        `Fetched: ${characters.length} characters, ${personas.length} personas, ${lorebooks.length} lorebooks, ${presets.length} presets, ${apiProfiles.length} API profiles, ${chats.length} chats, ${memory.length} memory entries`,
      )

      // Enrich chats with messages
      appendLog('Fetching chat messages…')
      const chatsWithMessages = await Promise.all(
        (chats as any[]).map(async (c, i) => {
          try {
            const messages = await fetch(
              `/api/chats/${c.id}/messages`,
            ).then((r) => r.json())
            setProgressValue(Math.round(((i + 1) / Math.max(1, chats.length)) * 50))
            return { ...c, messages }
          } catch {
            return { ...c, messages: [] }
          }
        }),
      )

      // Enrich lorebooks with entries
      appendLog('Fetching lorebook entries…')
      const lorebooksWithEntries = await Promise.all(
        (lorebooks as any[]).map(async (b, i) => {
          try {
            const detail = await fetch(`/api/lorebooks/${b.id}`).then((r) =>
              r.json(),
            )
            setProgressValue(
              50 + Math.round(((i + 1) / Math.max(1, lorebooks.length)) * 50),
            )
            return detail ?? b
          } catch {
            return b
          }
        }),
      )

      const backup: BackupFile = {
        version: 1,
        exportedAt: new Date().toISOString(),
        characters,
        personas,
        lorebooks: lorebooksWithEntries,
        presets,
        apiProfiles,
        chats: chatsWithMessages,
        memory,
        settings,
      }
      const ts = new Date().toISOString().slice(0, 10)
      downloadJSON(backup, `aetheria-backup-${ts}.json`)
      appendLog(`Downloaded aetheria-backup-${ts}.json`)
      finishProgress(true)
    } catch (e) {
      appendLog(`✗ ${(e as Error).message}`)
      finishProgress(false)
    }
  }, [appendLog, finishProgress, startProgress])

  // ---- Restore backup ----
  const handleRestoreFile = useCallback(
    async (file: File) => {
      startProgress('Restoring backup')
      try {
        const raw = await readJSONFile<BackupFile>(file)
        if (
          !raw ||
          typeof raw !== 'object' ||
          !('characters' in raw && 'personas' in raw)
        ) {
          throw new Error(
            'File does not look like an Aetheria backup (missing top-level keys).',
          )
        }
        const backup = raw as BackupFile
        appendLog(`Backup version: ${backup.version ?? 'unknown'}`)
        appendLog(`Exported at: ${backup.exportedAt ?? 'unknown'}`)

        const charIdMap = new Map<string, string>()
        const personaIdMap = new Map<string, string>()
        const lorebookIdMap = new Map<string, string>()
        const presetIdMap = new Map<string, string>()
        const apiProfileIdMap = new Map<string, string>()
        const chatIdMap = new Map<string, string>()

        const totalEntities =
          (backup.characters?.length ?? 0) +
          (backup.personas?.length ?? 0) +
          (backup.lorebooks?.length ?? 0) +
          (backup.presets?.length ?? 0) +
          (backup.apiProfiles?.length ?? 0) +
          (backup.chats?.length ?? 0) +
          (backup.memory?.length ?? 0) +
          1 // settings
        let done = 0
        const bump = () => {
          done += 1
          setProgressValue(Math.round((done / Math.max(1, totalEntities)) * 100))
        }

        // Characters
        const charFields = [
          'name', 'avatar', 'description', 'creator', 'version', 'tags',
          'favorite', 'personality', 'traits', 'behavior', 'values', 'goals',
          'likes', 'dislikes', 'emotionalTendency', 'speakingStyle',
          'scenario', 'setting', 'location', 'currentSituation',
          'relationship', 'worldContext', 'firstMessage', 'alternateGreetings',
          'exampleDialogue', 'speechPatterns', 'characterInstructions',
          'behavioralRules', 'responseInstructions', 'formattingRules',
          'roleplayInstructions', 'customFields', 'notes',
        ]
        for (const c of backup.characters ?? []) {
          try {
            const body: Record<string, unknown> = {}
            for (const k of charFields) if (k in c) body[k] = c[k]
            const created = await api<any>('/api/characters', {
              method: 'POST',
              body: JSON.stringify(body),
            })
            charIdMap.set(c.id, created.id)
            appendLog(`+ Character: ${c.name ?? 'Untitled'}`)
          } catch (e) {
            appendLog(`✗ Character "${c.name ?? '?'}": ${(e as Error).message}`)
          }
          bump()
        }

        // Personas
        const personaFields = [
          'name', 'description', 'personality', 'background', 'appearance',
          'behavior', 'speakingStyle', 'customInstructions', 'isDefault',
        ]
        for (const p of backup.personas ?? []) {
          try {
            const body: Record<string, unknown> = {}
            for (const k of personaFields) if (k in p) body[k] = p[k]
            const created = await api<any>('/api/personas', {
              method: 'POST',
              body: JSON.stringify(body),
            })
            personaIdMap.set(p.id, created.id)
            appendLog(`+ Persona: ${p.name ?? 'Untitled'}`)
          } catch (e) {
            appendLog(`✗ Persona "${p.name ?? '?'}": ${(e as Error).message}`)
          }
          bump()
        }

        // Lorebooks + entries
        const loreFields = [
          'name', 'description', 'tokenBudget', 'scanDepth', 'enabled',
          'boundCharacters',
        ]
        const entryFields = [
          'keys', 'aliases', 'content', 'comment', 'enabled', 'position',
          'order', 'depth', 'weight', 'activation', 'logic',
          'caseSensitive', 'wholeWord',
        ]
        for (const b of backup.lorebooks ?? []) {
          try {
            const body: Record<string, unknown> = {}
            for (const k of loreFields) if (k in b) body[k] = b[k]
            const created = await api<any>('/api/lorebooks', {
              method: 'POST',
              body: JSON.stringify(body),
            })
            const newBookId = created.id
            lorebookIdMap.set(b.id, newBookId)
            const entries = (b as any).entries ?? []
            for (const e of entries) {
              try {
                const eBody: Record<string, unknown> = {}
                for (const k of entryFields) if (k in e) eBody[k] = e[k]
                await api(`/api/lorebooks/${newBookId}/entries`, {
                  method: 'POST',
                  body: JSON.stringify(eBody),
                })
              } catch (err) {
                appendLog(
                  `  ✗ entry in "${b.name ?? '?'}": ${(err as Error).message}`,
                )
              }
            }
            appendLog(
              `+ Lorebook: ${b.name ?? 'Untitled'} (${entries.length} entries)`,
            )
          } catch (e) {
            appendLog(`✗ Lorebook "${b.name ?? '?'}": ${(e as Error).message}`)
          }
          bump()
        }

        // API profiles (apiKey not restored — backup doesn't include it)
        for (const p of backup.apiProfiles ?? []) {
          try {
            const body: Record<string, unknown> = {
              name: p.name ?? 'Restored Profile',
              provider: p.provider ?? 'openai',
              baseUrl: p.baseUrl ?? null,
              modelName: p.modelName ?? null,
              isDefault: false, // never auto-promote on restore
            }
            const created = await api<any>('/api/api-profiles', {
              method: 'POST',
              body: JSON.stringify(body),
            })
            apiProfileIdMap.set(p.id, created.id)
            appendLog(`+ API Profile: ${p.name ?? 'Untitled'} (key not restored)`)
          } catch (e) {
            appendLog(`✗ API Profile "${p.name ?? '?'}": ${(e as Error).message}`)
          }
          bump()
        }

        // Presets
        for (const p of backup.presets ?? []) {
          try {
            const oldApiId = p.apiProfileId
            const newApiId = oldApiId ? apiProfileIdMap.get(oldApiId) : null
            const body: Record<string, unknown> = {
              name: p.name ?? 'Restored Preset',
              description: p.description ?? null,
              providerType: p.providerType ?? null,
              modelName: p.modelName ?? null,
              apiProfileId: newApiId ?? null,
              genParams: p.genParams ?? {},
              promptSettings: p.promptSettings ?? {},
              isDefault: false,
            }
            const created = await api<any>('/api/presets', {
              method: 'POST',
              body: JSON.stringify(body),
            })
            presetIdMap.set(p.id, created.id)
            appendLog(`+ Preset: ${p.name ?? 'Untitled'}`)
          } catch (e) {
            appendLog(`✗ Preset "${p.name ?? '?'}": ${(e as Error).message}`)
          }
          bump()
        }

        // Chats (with messages)
        for (const c of backup.chats ?? []) {
          try {
            const newCharId = charIdMap.get(c.characterId)
            if (!newCharId) {
              appendLog(
                `✗ Chat "${c.title ?? '?'}": original character not found (was it skipped?)`,
              )
              bump()
              continue
            }
            const newPersonaId = c.personaId
              ? personaIdMap.get(c.personaId) ?? null
              : null
            const newPresetId = c.presetId
              ? presetIdMap.get(c.presetId) ?? null
              : null
            const newApiId = c.apiProfileId
              ? apiProfileIdMap.get(c.apiProfileId) ?? null
              : null
            const created = await api<any>('/api/chats', {
              method: 'POST',
              body: JSON.stringify({
                characterId: newCharId,
                personaId: newPersonaId,
                presetId: newPresetId,
                apiProfileId: newApiId,
                title: c.title ?? 'Restored Chat',
              }),
            })
            const newChatId = created.id
            chatIdMap.set(c.id, newChatId)

            // Clear the auto-created first message (chat POST seeds one from
            // character.firstMessage). We then re-import the original messages.
            try {
              const seededMsgs = await fetch(
                `/api/chats/${newChatId}/messages`,
              ).then((r) => r.json())
              if (Array.isArray(seededMsgs)) {
                for (const sm of seededMsgs) {
                  if (sm?.id) {
                    await api(`/api/messages/${sm.id}`, { method: 'DELETE' })
                  }
                }
              }
            } catch {
              /* ignore cleanup failure */
            }

            // Restore original messages (in chronological order so the
            // parent chain can be reconstructed). Skip non-active branches
            // — they'd require activeChildId manipulation not exposed via
            // the API.
            const origMessages = (c as any).messages ?? []
            const msgIdMap = new Map<string, string>()
            for (const m of origMessages) {
              try {
                if (m.isActive === false) continue
                const mappedParent = m.parentId
                  ? msgIdMap.get(m.parentId) ?? null
                  : null
                const createdMsg = await api<any>('/api/messages', {
                  method: 'POST',
                  body: JSON.stringify({
                    chatId: newChatId,
                    role: m.role,
                    content: m.content ?? '',
                    parentId: mappedParent,
                  }),
                })
                msgIdMap.set(m.id, createdMsg.id)
              } catch (err) {
                appendLog(
                  `  ✗ message in "${c.title ?? '?'}": ${(err as Error).message}`,
                )
              }
            }
            appendLog(
              `+ Chat: ${c.title ?? 'Untitled'} (${origMessages.length} messages)`,
            )
          } catch (e) {
            appendLog(`✗ Chat "${c.title ?? '?'}": ${(e as Error).message}`)
          }
          bump()
        }

        // Memory
        for (const m of backup.memory ?? []) {
          try {
            const newChatId = m.chatId ? chatIdMap.get(m.chatId) ?? null : null
            const newCharId = m.characterId
              ? charIdMap.get(m.characterId) ?? null
              : null
            await api('/api/memory', {
              method: 'POST',
              body: JSON.stringify({
                chatId: newChatId,
                characterId: newCharId,
                type: m.type ?? 'manual',
                content: m.content ?? '',
                enabled: m.enabled ?? true,
              }),
            })
          } catch (e) {
            appendLog(`✗ memory entry: ${(e as Error).message}`)
          }
          bump()
        }

        // Settings (upsert)
        try {
          const sBody = backup.settings ?? {}
          await api('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(sBody),
          })
          appendLog('+ Settings restored')
        } catch (e) {
          appendLog(`✗ Settings: ${(e as Error).message}`)
        }
        bump()

        finishProgress(
          true,
          'Restore complete. Reload the page to apply restored settings.',
        )
      } catch (e) {
        appendLog(`✗ ${(e as Error).message}`)
        finishProgress(false)
      }
    },
    [appendLog, finishProgress, startProgress],
  )

  const onRestoreInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) void handleRestoreFile(f)
      // Reset so selecting the same file again still fires change.
      e.target.value = ''
    },
    [handleRestoreFile],
  )

  // ---- Import character card ----
  const handleImportCard = useCallback(
    async (file: File) => {
      startProgress('Importing character card')
      try {
        const data = await readJSONFile<any>(file)
        const created = await api<any>('/api/characters/import', {
          method: 'POST',
          body: JSON.stringify(data),
        })
        appendLog(`+ Imported: ${created.name ?? 'Character'}`)
        finishProgress(true)
      } catch (e) {
        appendLog(`✗ ${(e as Error).message}`)
        finishProgress(false)
      }
    },
    [appendLog, finishProgress, startProgress],
  )

  const onImportCardChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) void handleImportCard(f)
      e.target.value = ''
    },
    [handleImportCard],
  )

  // ---- Export all characters as a single JSON array of CharacterCards ----
  const handleExportAllCharacters = useCallback(async () => {
    startProgress('Exporting all characters')
    try {
      const list = await fetch('/api/characters').then((r) => r.json())
      appendLog(`Found ${list.length} characters`)
      const cards: any[] = []
      let i = 0
      for (const c of list) {
        try {
          const card = await fetch(`/api/characters/${c.id}/export`).then((r) =>
            r.json(),
          )
          cards.push(card)
        } catch (e) {
          appendLog(`✗ "${c.name ?? '?'}": ${(e as Error).message}`)
        }
        i += 1
        setProgressValue(Math.round((i / Math.max(1, list.length)) * 100))
      }
      const ts = new Date().toISOString().slice(0, 10)
      downloadJSON(cards, `aetheria-characters-${ts}.json`)
      appendLog(`Downloaded ${cards.length} character cards`)
      finishProgress(true)
    } catch (e) {
      appendLog(`✗ ${(e as Error).message}`)
      finishProgress(false)
    }
  }, [appendLog, finishProgress, startProgress])

  // ---- Clear all data ----
  const handleClearAll = useCallback(async () => {
    setClearOpen(false)
    startProgress('Clearing all data')
    try {
      const lists = await Promise.all([
        fetch('/api/characters').then((r) => r.json()),
        fetch('/api/personas').then((r) => r.json()),
        fetch('/api/lorebooks').then((r) => r.json()),
        fetch('/api/presets').then((r) => r.json()),
        fetch('/api/api-profiles').then((r) => r.json()),
        fetch('/api/chats').then((r) => r.json()),
        fetch('/api/memory').then((r) => r.json()),
      ])
      const [
        characters,
        personas,
        lorebooks,
        presets,
        apiProfiles,
        chats,
        memory,
      ] = lists as any[][]
      const total =
        characters.length +
        personas.length +
        lorebooks.length +
        presets.length +
        apiProfiles.length +
        chats.length +
        memory.length
      appendLog(`Found ${total} entities to delete`)
      let done = 0
      const del = async (url: string, label: string) => {
        try {
          await api(url, { method: 'DELETE' })
        } catch (e) {
          appendLog(`✗ ${label}: ${(e as Error).message}`)
        }
        done += 1
        setProgressValue(Math.round((done / Math.max(1, total)) * 100))
      }
      for (const c of characters) await del(`/api/characters/${c.id}`, `character "${c.name}"`)
      for (const p of personas) await del(`/api/personas/${p.id}`, `persona "${p.name}"`)
      for (const b of lorebooks) await del(`/api/lorebooks/${b.id}`, `lorebook "${b.name}"`)
      for (const p of presets) await del(`/api/presets/${p.id}`, `preset "${p.name}"`)
      for (const p of apiProfiles) await del(`/api/api-profiles/${p.id}`, `api profile "${p.name}"`)
      for (const c of chats) await del(`/api/chats/${c.id}`, `chat "${c.title}"`)
      for (const m of memory) await del(`/api/memory/${m.id}`, 'memory entry')

      appendLog('Note: settings are not cleared (use the toggles above to reset).')
      finishProgress(true, 'All content data deleted.')
    } catch (e) {
      appendLog(`✗ ${(e as Error).message}`)
      finishProgress(false)
    }
  }, [appendLog, finishProgress, startProgress])

  // ---- Render ----

  return (
    <div className="space-y-4">
      <SectionCard
        title="Backup & Restore"
        description="Export your entire local database to a single JSON file, or restore one back. Restore is additive — it never deletes existing data."
      >
        <SettingRow
          title="Export backup"
          description="Download all characters, personas, lorebooks, presets, API profiles (without keys), chats, memory, and settings as one JSON file."
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleExportBackup}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </SettingRow>
        <SettingRow
          title="Restore backup"
          description="Import a previously-exported backup file. Existing data is preserved — restored items will be added as duplicates."
          isLast
        >
          <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Restore
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will re-import every character, persona, lorebook,
                  preset, API profile, chat, and memory entry from the backup
                  file as <strong>new duplicates</strong>. Existing data is
                  never deleted. API keys are not included in backups —
                  restored API profiles will need their keys re-entered. Chat
                  branches (alternate swipes) are not restored; only the active
                  timeline is.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setRestoreOpen(false)
                    restoreInputRef.current?.click()
                  }}
                >
                  Choose file
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onRestoreInputChange}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Characters"
        description="Import a single character card, or export every character as a portable JSON array."
      >
        <SettingRow
          title="Import character card"
          description="Import a CharacterCard V2 JSON file (with a top-level data object, or a flat shape)."
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => importCardInputRef.current?.click()}
          >
            <FileJson className="h-3.5 w-3.5" />
            Import card
          </Button>
          <input
            ref={importCardInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportCardChange}
          />
        </SettingRow>
        <SettingRow
          title="Export all characters"
          description="Download every character as a single JSON array of CharacterCard V2 objects."
          isLast
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleExportAllCharacters}
          >
            <Download className="h-3.5 w-3.5" />
            Export all
          </Button>
        </SettingRow>
      </SectionCard>

      <Card className="gap-2 border-destructive/30 bg-destructive/5 py-4">
        <CardHeader className="gap-1 px-4 py-0">
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-xs">
            Permanently delete every character, chat, persona, lorebook,
            preset, API profile, and memory entry from this device. This cannot
            be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-0">
          <AlertDialog open={clearOpen} onOpenChange={(o) => {
            setClearOpen(o)
            if (!o) setClearConfirm('')
          }}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete everything?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      This will permanently delete every character, chat,
                      persona, lorebook, preset, API profile, and memory entry
                      on this device. Settings will be preserved.
                    </p>
                    <p>
                      To confirm, type{' '}
                      <strong className="font-mono text-foreground">DELETE</strong>{' '}
                      below.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={clearConfirm}
                onChange={(e) => setClearConfirm(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
                autoFocus
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={clearConfirm !== 'DELETE' || progressRunning}
                  onClick={handleClearAll}
                  className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <ProgressDialog
        open={progressOpen}
        onOpenChange={(o) => {
          if (!progressRunning) setProgressOpen(o)
        }}
        title={progressTitle}
        log={progressLog}
        value={progressValue}
        running={progressRunning}
        logEndRef={logEndRef}
      />
    </div>
  )
}

// ============================================================
// Progress dialog
// ============================================================

function ProgressDialog({
  open,
  onOpenChange,
  title,
  log,
  value,
  running,
  logEndRef,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  log: string[]
  value: number
  running: boolean
  logEndRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!running) onOpenChange(o)
      }}
    >
      <DialogContent
        showCloseButton={!running}
        className="sm:max-w-[560px]"
        onEscapeKeyDown={(e) => {
          if (running) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (running) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {running
              ? 'Working… keep this window open.'
              : 'Operation complete.'}
          </DialogDescription>
        </DialogHeader>

        <Progress value={value} className="h-2" />

        <div className="max-h-[320px] overflow-y-auto rounded-md border bg-muted/40">
          <div className="p-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/90">
              {log.length === 0 ? 'Starting…' : log.join('\n')}
            </pre>
            <div ref={logEndRef} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={running}
            onClick={() => onOpenChange(false)}
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
              </>
            ) : (
              'Close'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
