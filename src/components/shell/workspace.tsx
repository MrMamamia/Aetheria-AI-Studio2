'use client'

import { useAppStore } from '@/lib/store'
import { CharacterLibrary } from '@/components/characters/character-library'
import { CharacterEditor } from '@/components/characters/character-editor'
import { ChatView } from '@/components/chat/chat-view'
import { PersonasView } from '@/components/personas/personas-view'
import { LorebooksView } from '@/components/lorebooks/lorebooks-view'
import { PresetsView } from '@/components/presets/presets-view'
import { ApiManager } from '@/components/api/api-manager'
import { SettingsView } from '@/components/settings/settings-view'

export function Workspace() {
  const view = useAppStore((s) => s.view)

  switch (view) {
    case 'characters':
      return <CharacterLibrary />
    case 'character-editor':
      return <CharacterEditor />
    case 'chat':
      return <ChatView />
    case 'personas':
      return <PersonasView />
    case 'lorebooks':
      return <LorebooksView />
    case 'presets':
      return <PresetsView />
    case 'api':
      return <ApiManager />
    case 'settings':
      return <SettingsView />
    default:
      return <CharacterLibrary />
  }
}
