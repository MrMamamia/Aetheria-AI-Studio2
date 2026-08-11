'use client'

import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useFetch, api } from '@/hooks/use-fetch'
import { Avatar } from '@/components/shared/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowLeft, Save, Plus, X, Star, MessageSquare, ImagePlus, Trash2, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'personality', label: 'Personality' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'greetings', label: 'Greetings' },
  { id: 'dialogue', label: 'Dialogue Examples' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'metadata', label: 'Metadata' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function parseArr(s: any): string[] {
  if (!s) return []
  if (Array.isArray(s)) return s
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
function parseFields(s: any): { key: string; label: string; value: string }[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

const EMPTY_DRAFT = {
  name: 'New Character',
  avatar: null,
  description: '',
  creator: '',
  version: '1.0',
  tags: [],
  favorite: false,
  personality: '', traits: [], behavior: '', values: '', goals: '',
  likes: '', dislikes: '', emotionalTendency: '', speakingStyle: '',
  scenario: '', setting: '', location: '', currentSituation: '',
  relationship: '', worldContext: '',
  firstMessage: '', alternateGreetings: [], exampleDialogue: '', speechPatterns: '',
  characterInstructions: '', behavioralRules: '', responseInstructions: '',
  formattingRules: '', roleplayInstructions: '',
  customFields: [],
  notes: '',
}

export function CharacterEditor() {
  const editingId = useAppStore((s) => s.editingCharacterId)
  if (!editingId) return null
  if (editingId === 'new') {
    return <EditorBody key="new" editingId="new" initialDraft={{ ...EMPTY_DRAFT }} />
  }
  return <ExistingLoader key={editingId} editingId={editingId} />
}

function ExistingLoader({ editingId }: { editingId: string }) {
  const { data: existing, loading } = useFetch<any>(`/api/characters/${editingId}`)
  if (!existing) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {loading ? 'Loading editor...' : 'Preparing editor...'}
      </div>
    )
  }
  return (
    <EditorBody
      editingId={editingId}
      initialDraft={{
        ...existing,
        tags: parseArr(existing.tags),
        traits: parseArr(existing.traits),
        alternateGreetings: parseArr(existing.alternateGreetings),
        customFields: parseFields(existing.customFields),
      }}
    />
  )
}

function EditorBody({ editingId, initialDraft }: { editingId: string; initialDraft: any }) {
  const setEditingCharacter = useAppStore((s) => s.setEditingCharacter)
  const setView = useAppStore((s) => s.setView)
  const [section, setSection] = useState<SectionId>('overview')
  const isNew = editingId === 'new'
  const [draft, setDraft] = useState<any>(() => initialDraft)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(async (data: any) => {
    if (!data) return
    const payload = {
      ...data,
      tags: JSON.stringify(data.tags || []),
      traits: JSON.stringify(data.traits || []),
      alternateGreetings: JSON.stringify(data.alternateGreetings || []),
      customFields: JSON.stringify(data.customFields || []),
    }
    delete payload.chats
    delete payload._count
    try {
      if (isNew) {
        const created = await api('/api/characters', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Character created')
        setEditingCharacter(created.id)
      } else {
        await api(`/api/characters/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      }
      setSaving('saved')
      setTimeout(() => setSaving('idle'), 1500)
    } catch (e) {
      toast.error((e as Error).message)
      setSaving('idle')
    }
  }, [editingId, isNew, setEditingCharacter])

  const update = useCallback((patch: any) => {
    setDraft((d: any) => {
      const next = { ...d, ...patch }
      dirtyRef.current = true
      setSaving('saving')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => persist(next), 800)
      return next
    })
  }, [persist])

  const handleBack = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dirtyRef.current && draft) persist(draft)
    setEditingCharacter(null)
    setView('characters')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar name={draft.name} src={draft.avatar} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Input
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              className="h-8 border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0"
            />
            {draft.favorite && <Star className="h-4 w-4 fill-primary text-primary" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>v{draft.version}</span>
            <span>·</span>
            {saving === 'saving' && <span className="text-amber-600">Saving…</span>}
            {saving === 'saved' && <span className="text-emerald-600">Saved</span>}
            {saving === 'idle' && <span>All changes saved locally</span>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => update({ favorite: !draft.favorite })}
        >
          <Star className={cn('h-4 w-4', draft.favorite && 'fill-primary text-primary')} />
        </Button>
      </div>

      {/* Body: section nav + form */}
      <div className="flex min-h-0 flex-1">
        {/* Section nav */}
        <nav className="w-48 shrink-0 border-r p-2">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <Button
                  key={s.id}
                  variant={section === s.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-full justify-start px-2.5 text-sm font-normal"
                  onClick={() => setSection(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </nav>

        {/* Form */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-2xl space-y-5 p-6">
            {section === 'overview' && (
              <OverviewSection draft={draft} update={update} />
            )}
            {section === 'personality' && (
              <PersonalitySection draft={draft} update={update} />
            )}
            {section === 'scenario' && (
              <ScenarioSection draft={draft} update={update} />
            )}
            {section === 'greetings' && (
              <GreetingsSection draft={draft} update={update} />
            )}
            {section === 'dialogue' && (
              <DialogueSection draft={draft} update={update} />
            )}
            {section === 'instructions' && (
              <InstructionsSection draft={draft} update={update} />
            )}
            {section === 'advanced' && (
              <AdvancedSection draft={draft} update={update} />
            )}
            {section === 'metadata' && (
              <MetadataSection draft={draft} update={update} />
            )}
          </div>
        </ScrollArea>

        {/* Live preview */}
        <aside className="hidden w-72 shrink-0 border-l bg-muted/30 xl:block">
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Live Preview
            </div>
            <Card className="flex flex-col gap-3 p-3">
              <div className="flex items-center gap-3">
                <Avatar name={draft.name} src={draft.avatar} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{draft.name || 'Unnamed'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {draft.creator ? `by ${draft.creator}` : 'no creator'}
                  </p>
                </div>
              </div>
              <p className="line-clamp-4 text-sm text-muted-foreground">
                {draft.description || 'No description.'}
              </p>
              {draft.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {draft.tags.slice(0, 5).map((t: string) => (
                    <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
            {draft.firstMessage && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  First Message
                </p>
                <Card className="p-3">
                  <p className="line-clamp-6 text-sm text-muted-foreground">
                    {draft.firstMessage}
                  </p>
                </Card>
              </div>
            )}
            <div className="mt-auto pt-3 text-[11px] text-muted-foreground">
              <p>Token estimate (context):</p>
              <p className="font-mono text-foreground">
                ~{Math.ceil(((draft.description || '') + (draft.personality || '') + (draft.firstMessage || '')).length / 4)} tokens
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---- Section components ----

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">{hint}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {children}
    </div>
  )
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setInput('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background p-1.5">
      {value.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1 pr-1">
          {t}
          <button onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-sm hover:bg-background">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder={placeholder || 'Type and press Enter…'}
        className="min-w-[100px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

function OverviewSection({ draft, update }: { draft: any; update: (p: any) => void }) {
  const handleAvatar = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => update({ avatar: reader.result })
      reader.readAsDataURL(file)
    }
    input.click()
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={draft.name} src={draft.avatar} size="xl" />
          <Button
            variant="secondary"
            size="icon"
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full"
            onClick={handleAvatar}
          >
            <ImagePlus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex-1 space-y-2">
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Character name" />
          </Field>
        </div>
      </div>
      <Field label="Description" hint="A concise summary of who this character is. This is always included in the model context.">
        <Textarea
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Describe the character's appearance, role, and essence."
          rows={4}
        />
      </Field>
      <Field label="Tags" hint="Tags help you organize and filter your character library.">
        <TagInput value={draft.tags} onChange={(tags) => update({ tags })} placeholder="Add tags…" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Creator">
          <Input value={draft.creator || ''} onChange={(e) => update({ creator: e.target.value })} placeholder="Your name" />
        </Field>
        <Field label="Version">
          <Input value={draft.version} onChange={(e) => update({ version: e.target.value })} placeholder="1.0" />
        </Field>
      </div>
    </div>
  )
}

function PersonalitySection({ draft, update }: { draft: any; update: (p: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Personality" hint="The character's core personality. Always injected into context.">
        <Textarea value={draft.personality} onChange={(e) => update({ personality: e.target.value })} rows={4} placeholder="e.g. Reserved but warm, observant, dryly witty…" />
      </Field>
      <Field label="Traits">
        <TagInput value={draft.traits} onChange={(traits) => update({ traits })} placeholder="Add traits…" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Behavior">
          <Textarea value={draft.behavior} onChange={(e) => update({ behavior: e.target.value })} rows={3} />
        </Field>
        <Field label="Values">
          <Textarea value={draft.values} onChange={(e) => update({ values: e.target.value })} rows={3} />
        </Field>
        <Field label="Goals">
          <Textarea value={draft.goals} onChange={(e) => update({ goals: e.target.value })} rows={3} />
        </Field>
        <Field label="Emotional Tendency">
          <Textarea value={draft.emotionalTendency} onChange={(e) => update({ emotionalTendency: e.target.value })} rows={3} />
        </Field>
        <Field label="Likes">
          <Textarea value={draft.likes} onChange={(e) => update({ likes: e.target.value })} rows={3} />
        </Field>
        <Field label="Dislikes">
          <Textarea value={draft.dislikes} onChange={(e) => update({ dislikes: e.target.value })} rows={3} />
        </Field>
      </div>
      <Field label="Speaking Style" hint="How the character talks — vocabulary, cadence, quirks.">
        <Textarea value={draft.speakingStyle} onChange={(e) => update({ speakingStyle: e.target.value })} rows={3} />
      </Field>
    </div>
  )
}

function ScenarioSection({ draft, update }: { draft: any; update: (p: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Scenario" hint="The overall situation the conversation begins in.">
        <Textarea value={draft.scenario} onChange={(e) => update({ scenario: e.target.value })} rows={3} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Setting">
          <Textarea value={draft.setting} onChange={(e) => update({ setting: e.target.value })} rows={2} />
        </Field>
        <Field label="Location">
          <Textarea value={draft.location} onChange={(e) => update({ location: e.target.value })} rows={2} />
        </Field>
      </div>
      <Field label="Current Situation">
        <Textarea value={draft.currentSituation} onChange={(e) => update({ currentSituation: e.target.value })} rows={3} />
      </Field>
      <Field label="Relationship with User">
        <Textarea value={draft.relationship} onChange={(e) => update({ relationship: e.target.value })} rows={2} />
      </Field>
      <Field label="World Context" hint="Background lore about the world the character inhabits.">
        <Textarea value={draft.worldContext} onChange={(e) => update({ worldContext: e.target.value })} rows={3} />
      </Field>
    </div>
  )
}

function GreetingsSection({ draft, update }: { draft: any; update: (p: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="First Message" hint="The opening message the character sends when a new chat begins. This sets the tone.">
        <Textarea
          value={draft.firstMessage}
          onChange={(e) => update({ firstMessage: e.target.value })}
          rows={8}
          placeholder="Write the character's opening message. Use *asterisks* for actions and &quot;quotes&quot; for speech."
          className="font-mono text-sm"
        />
      </Field>
      <Separator />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm font-medium">Alternate Greetings</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => update({ alternateGreetings: [...(draft.alternateGreetings || []), ''] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add greeting
          </Button>
        </div>
        <div className="space-y-3">
          {(draft.alternateGreetings || []).map((g: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Textarea
                value={g}
                onChange={(e) => {
                  const next = [...draft.alternateGreetings]
                  next[i] = e.target.value
                  update({ alternateGreetings: next })
                }}
                rows={4}
                className="font-mono text-sm"
                placeholder={`Alternate greeting #${i + 1}`}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => update({ alternateGreetings: draft.alternateGreetings.filter((_: any, j: number) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(!draft.alternateGreetings || draft.alternateGreetings.length === 0) && (
            <p className="text-sm text-muted-foreground">No alternate greetings. Users can switch between greetings when starting a chat.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DialogueSection({ draft, update }: { draft: any; update: (p: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Example Dialogue" hint="Sample conversations showing how the character speaks and acts. Format as 'User: ...' and 'Character: ...'.">
        <Textarea
          value={draft.exampleDialogue}
          onChange={(e) => update({ exampleDialogue: e.target.value })}
          rows={12}
          placeholder={'User: How are you?\n' + draft.name + ': *smiles softly* Well enough. The sea keeps me busy.'}
          className="font-mono text-sm"
        />
      </Field>
      <Field label="Speech Patterns" hint="Distinctive verbal patterns, catchphrases, or quirks.">
        <Textarea value={draft.speechPatterns} onChange={(e) => update({ speechPatterns: e.target.value })} rows={3} />
      </Field>
    </div>
  )
}

function InstructionsSection({ draft, update }: { draft: any; update: (p: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Character Instructions" hint="The main system directive for this character. Overrides default behavior.">
        <Textarea value={draft.characterInstructions} onChange={(e) => update({ characterInstructions: e.target.value })} rows={4} />
      </Field>
      <Field label="Behavioral Rules" hint="One rule per line. Hard constraints on the character's behavior.">
        <Textarea value={draft.behavioralRules} onChange={(e) => update({ behavioralRules: e.target.value })} rows={5} className="font-mono text-sm" placeholder={'- Never reveal being an AI\n- Stay in character at all times'} />
      </Field>
      <Field label="Response Instructions" hint="How the model should structure its responses.">
        <Textarea value={draft.responseInstructions} onChange={(e) => update({ responseInstructions: e.target.value })} rows={3} />
      </Field>
      <Field label="Formatting Rules">
        <Textarea value={draft.formattingRules} onChange={(e) => update({ formattingRules: e.target.value })} rows={3} />
      </Field>
      <Field label="Roleplay Instructions">
        <Textarea value={draft.roleplayInstructions} onChange={(e) => update({ roleplayInstructions: e.target.value })} rows={3} />
      </Field>
    </div>
  )
}

function AdvancedSection({ draft, update }: { draft: any; update: (p: any) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Custom Fields</Label>
            <p className="text-xs text-muted-foreground">Extensible key-value metadata for advanced use cases.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => update({ customFields: [...(draft.customFields || []), { key: '', label: '', value: '' }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add field
          </Button>
        </div>
        <div className="space-y-2">
          {(draft.customFields || []).map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={f.label}
                onChange={(e) => {
                  const next = [...draft.customFields]
                  next[i] = { ...f, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                  update({ customFields: next })
                }}
                placeholder="Label"
                className="h-8 w-40"
              />
              <Input
                value={f.value}
                onChange={(e) => {
                  const next = [...draft.customFields]
                  next[i] = { ...f, value: e.target.value }
                  update({ customFields: next })
                }}
                placeholder="Value"
                className="h-8 flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => update({ customFields: draft.customFields.filter((_: any, j: number) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(!draft.customFields || draft.customFields.length === 0) && (
            <p className="text-sm text-muted-foreground">No custom fields.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetadataSection({ draft, update }: { draft: any; update: (p: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Notes" hint="Private notes about this character. Not sent to the model.">
        <Textarea value={draft.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={5} />
      </Field>
      <Separator />
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-mono">{draft.createdAt ? new Date(draft.createdAt).toLocaleString() : '—'}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span className="font-mono">{draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : '—'}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Character ID</span><span className="font-mono text-xs">{draft.id || '—'}</span></div>
      </div>
    </div>
  )
}
