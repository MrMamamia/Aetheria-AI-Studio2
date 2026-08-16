'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useFetch, api } from '@/hooks/use-fetch'
import { Avatar } from '@/components/shared/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Slider,
} from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import {
  Pencil, User, Brain, SlidersHorizontal, Bug, Plus, Trash2, Pin,
} from 'lucide-react'
import { toast } from 'sonner'
import { estimateTokens, PROVIDERS, DEFAULT_GEN_PARAMS } from '@/lib/providers'
import type { GenParams } from '@/lib/types'

export function Inspector() {
  const tab = useAppStore((s) => s.inspectorTab)
  const setTab = useAppStore((s) => s.setInspectorTab)
  const activeChatId = useAppStore((s) => s.activeChatId)
  const setEditingCharacter = useAppStore((s) => s.setEditingCharacter)
  const lastContext = useAppStore((s) => s.lastContext)

  const { data: chat, reload } = useFetch<any>(activeChatId ? `/api/chats/${activeChatId}` : null, [activeChatId])
  const character = chat?.character

  const { data: personas } = useFetch<any[]>('/api/personas')
  const { data: presets } = useFetch<any[]>('/api/presets')
  const { data: apiProfiles } = useFetch<any[]>('/api/api-profiles')
  const { data: memories, reload: reloadMem } = useFetch<any[]>(
    activeChatId ? `/api/memory?chatId=${activeChatId}` : null,
  )
  const { data: settings } = useFetch<any>('/api/settings')
  const debugMode = settings?.debugMode === 'true' || settings?.debugMode === true

  const updateChat = async (patch: any) => {
    try {
      await api(`/api/chats/${activeChatId}`, { method: 'PUT', body: JSON.stringify(patch) })
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col border-l bg-sidebar text-sidebar-foreground">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex h-full flex-col">
        <div className="border-b px-2 pt-2">
          <TabsList className="grid w-full grid-cols-5 h-9">
            <TabsTrigger value="character" className="text-xs gap-1"><User className="h-3.5 w-3.5" /><span className="hidden lg:inline">Char</span></TabsTrigger>
            <TabsTrigger value="context" className="text-xs gap-1"><Brain className="h-3.5 w-3.5" /><span className="hidden lg:inline">Context</span></TabsTrigger>
            <TabsTrigger value="generation" className="text-xs gap-1"><SlidersHorizontal className="h-3.5 w-3.5" /><span className="hidden lg:inline">Gen</span></TabsTrigger>
            <TabsTrigger value="memory" className="text-xs gap-1"><Pin className="h-3.5 w-3.5" /><span className="hidden lg:inline">Mem</span></TabsTrigger>
            <TabsTrigger value="debug" className="text-xs gap-1"><Bug className="h-3.5 w-3.5" /><span className="hidden lg:inline">Debug</span></TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="character" className="m-0 p-4">
            {character ? <CharacterTab character={character} onEdit={() => setEditingCharacter(character.id)} /> : <EmptyInspector />}
          </TabsContent>
          <TabsContent value="context" className="m-0 p-4">
            <ContextTab chatId={activeChatId} lastContext={lastContext} />
          </TabsContent>
          <TabsContent value="generation" className="m-0 p-4">
            {chat ? (
              <GenerationTab
                chat={chat}
                personas={personas || []}
                presets={presets || []}
                apiProfiles={apiProfiles || []}
                onUpdate={updateChat}
              />
            ) : <EmptyInspector />}
          </TabsContent>
          <TabsContent value="memory" className="m-0 p-4">
            <MemoryTab chatId={activeChatId} memories={memories || []} reload={reloadMem} characterId={character?.id} />
          </TabsContent>
          <TabsContent value="debug" className="m-0 p-4">
            <DebugTab chatId={activeChatId} debugMode={debugMode} lastContext={lastContext} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

function EmptyInspector() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
      <span>No active chat.</span>
    </div>
  )
}

function CharacterTab({ character, onEdit }: { character: any; onEdit: () => void }) {
  const parseArr = (s: any) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar name={character.name} src={character.avatar} size="xl" />
        <div>
          <p className="font-medium">{character.name}</p>
          {character.creator && <p className="text-xs text-muted-foreground">by {character.creator}</p>}
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit character
        </Button>
      </div>
      <Separator />
      {character.description && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</p>
          <p className="text-sm">{character.description}</p>
        </div>
      )}
      {character.personality && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Personality</p>
          <p className="text-sm">{character.personality}</p>
        </div>
      )}
      {parseArr(character.traits).length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Traits</p>
          <div className="flex flex-wrap gap-1">
            {parseArr(character.traits).map((t: string) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        </div>
      )}
      {character.scenario && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Scenario</p>
          <p className="text-sm">{character.scenario}</p>
        </div>
      )}
      {character.relationship && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Relationship</p>
          <p className="text-sm">{character.relationship}</p>
        </div>
      )}
    </div>
  )
}

function ContextTab({ chatId, lastContext }: { chatId: string | null; lastContext: any }) {
  const [ctx, setCtx] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const build = async () => {
    if (!chatId) return
    setLoading(true)
    try {
      const res = await api<any>('/api/context', {
        method: 'POST',
        body: JSON.stringify({ chatId, userInput: '' }),
      })
      setCtx(res)
      useAppStore.getState().setLastContext(res)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (lastContext) setCtx(lastContext)
  }, [lastContext])

  if (!chatId) return <EmptyInspector />

  const pct = ctx ? Math.min(100, Math.round((ctx.totalTokens / ctx.contextLimit) * 100)) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Prompt Inspector</p>
          <p className="text-xs text-muted-foreground">See exactly what the model receives.</p>
        </div>
        <Button size="sm" variant="outline" className="h-7" onClick={build} disabled={loading}>
          {loading ? 'Building…' : ctx ? 'Refresh' : 'Build'}
        </Button>
      </div>

      {ctx && (
        <>
          <Card className="p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium">Context usage</span>
              <span className="font-mono">{ctx.totalTokens.toLocaleString()} / {ctx.contextLimit.toLocaleString()}</span>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">{pct}% used · {ctx.sections.length} sections · {ctx.messages.length} messages sent</p>
          </Card>

          <div className="space-y-2">
            {ctx.sections.map((s: any) => (
              <Card key={s.id} className="p-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium">{s.label}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{s.tokens} tok</Badge>
                </div>
                <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                  {s.content.slice(0, 600)}{s.content.length > 600 ? '…' : ''}
                </pre>
              </Card>
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Final message sequence</p>
            <Card className="p-2.5">
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                {ctx.messages.map((m: any) => `[${m.role}]\n${m.content.slice(0, 300)}${m.content.length > 300 ? '…' : ''}`).join('\n\n')}
              </pre>
            </Card>
          </div>
        </>
      )}

      {!ctx && !loading && (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          Click <span className="font-medium">Build</span> to inspect the prompt that will be sent to the model on the next turn.
        </div>
      )}
    </div>
  )
}

function GenerationTab({ chat, personas, presets, apiProfiles, onUpdate }: {
  chat: any; personas: any[]; presets: any[]; apiProfiles: any[]; onUpdate: (p: any) => void
}) {
  // Resolve effective preset + api profile
  const preset = chat.preset || presets.find((p) => p.isDefault) || presets[0]
  const apiProfile = chat.apiProfile || apiProfiles.find((p) => p.isDefault) || apiProfiles[0]
  const providerType = preset?.providerType || apiProfile?.provider || 'openai'
  const caps = PROVIDERS[providerType as keyof typeof PROVIDERS]?.capabilities
  const genParams: GenParams = preset?.genParams ? (typeof preset.genParams === 'string' ? JSON.parse(preset.genParams) : preset.genParams) : DEFAULT_GEN_PARAMS

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium">Persona</Label>
        <Select value={chat.personaId || '__none__'} onValueChange={(v) => onUpdate({ personaId: v === '__none__' ? null : v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default persona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.isDefault && ' (default)'}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Preset</Label>
        <Select value={chat.presetId || ''} onValueChange={(v) => onUpdate({ presetId: v || null })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default preset" /></SelectTrigger>
          <SelectContent>
            {presets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.isDefault && ' (default)'}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Model: {apiProfile?.modelName || PROVIDERS[providerType as keyof typeof PROVIDERS]?.defaultModels?.[0]?.id || preset?.modelName || '—'}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">API Profile</Label>
        <Select value={chat.apiProfileId || ''} onValueChange={(v) => onUpdate({ apiProfileId: v || null })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default profile" /></SelectTrigger>
          <SelectContent>
            {apiProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.isDefault && ' (default)'}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Provider: {PROVIDERS[providerType as keyof typeof PROVIDERS]?.label || providerType}</p>
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Generation params (from preset)</p>
        <div className="space-y-3">
          {caps?.temperature && (
            <GenSlider label="Temperature" value={genParams.temperature ?? 0.9} min={0} max={2} step={0.05} />
          )}
          {caps?.topP && (
            <GenSlider label="Top P" value={genParams.topP ?? 1} min={0} max={1} step={0.01} />
          )}
          {caps?.topK && (
            <GenSlider label="Top K" value={genParams.topK ?? 40} min={0} max={100} step={1} />
          )}
          {caps?.maxTokens && (
            <GenSlider label="Max tokens" value={genParams.maxTokens ?? 512} min={64} max={8192} step={64} />
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Edit the preset in <span className="font-medium">Presets</span> to change these values.
        </p>
      </div>
    </div>
  )
}

function GenSlider({ label, value, min, max, step }: { label: string; value: number; min: number; max: number; step: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} disabled className="opacity-70" />
    </div>
  )
}

function MemoryTab({ chatId, memories, reload, characterId }: {
  chatId: string | null; memories: any[]; reload: () => void; characterId?: string
}) {
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState('manual')

  const add = async () => {
    if (!newContent.trim() || !chatId) return
    try {
      await api('/api/memory', {
        method: 'POST',
        body: JSON.stringify({
          chatId,
          characterId,
          type: newType,
          content: newContent,
          tokens: estimateTokens(newContent),
        }),
      })
      setNewContent('')
      reload()
      toast.success('Memory added')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const del = async (id: string) => {
    try {
      await api(`/api/memory/${id}`, { method: 'DELETE' })
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const toggle = async (m: any) => {
    try {
      await api(`/api/memory/${m.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !m.enabled }) })
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!chatId) return <EmptyInspector />

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Memory</p>
        <p className="text-xs text-muted-foreground">Facts, summaries, and pinned info injected into context.</p>
      </div>

      <Card className="space-y-2 p-3">
        <Textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add a memory, fact, or summary…"
          rows={3}
          className="text-sm"
        />
        <div className="flex items-center gap-2">
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="fact">Fact</SelectItem>
              <SelectItem value="pinned">Pinned</SelectItem>
              <SelectItem value="summary">Summary</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 gap-1.5" onClick={add} disabled={!newContent.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {memories.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">No memories yet. Add important context above.</p>
        )}
        {memories.map((m) => (
          <Card key={m.id} className="p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
              <div className="flex items-center gap-1">
                <Switch checked={m.enabled} onCheckedChange={() => toggle(m)} />
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => del(m.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs">{m.content}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">~{m.tokens} tokens</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DebugTab({ chatId, debugMode, lastContext }: { chatId: string | null; debugMode: boolean; lastContext: any }) {
  const { data: settings } = useFetch<any>('/api/settings')
  const setSetting = async (key: string, value: string) => {
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ [key]: value }) })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!chatId) return <EmptyInspector />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Developer mode</p>
          <p className="text-xs text-muted-foreground">Show raw request details & prompt inspector.</p>
        </div>
        <Switch
          checked={debugMode}
          onCheckedChange={(v) => setSetting('debugMode', String(v))}
        />
      </div>

      <Separator />

      {debugMode ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Last context</p>
            {lastContext ? (
              <Card className="p-2.5">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span>{lastContext.sections?.length || 0} sections</span>
                  <span className="font-mono">{lastContext.totalTokens} / {lastContext.contextLimit} tok</span>
                </div>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-[10px] leading-relaxed text-muted-foreground">
                  {lastContext.messages?.map((m: any) => `=== ${m.role.toUpperCase()} ===\n${m.content}`).join('\n\n')}
                </pre>
              </Card>
            ) : (
              <p className="text-xs text-muted-foreground">No context built yet. Use the Context tab to build one.</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Request info</p>
            <Card className="space-y-1 p-2.5 text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Endpoint</span><span className="font-mono">/api/generate (SSE)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Stream</span><span className="font-mono">text/event-stream</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">API keys</span><span className="font-mono text-emerald-600">never exposed</span></div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          Enable developer mode to inspect raw requests, token usage, and the full prompt pipeline.
        </div>
      )}
    </div>
  )
}
