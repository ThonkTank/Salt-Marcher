import { useState } from 'react'
import type { PartyCharacter } from '../../../shared/contracts/party.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import type {
  Treasure,
  TreasureAnchor
} from '../../../shared/contracts/loot.js'
import type { SessionDialogState } from './session-workspace-model.js'

export function useSessionDialogController() {
  const [dialog, setDialog] = useState<SessionDialogState>({ kind: 'none' })

  return {
    dialog,
    close: () => setDialog({ kind: 'none' }),
    editParty: () => setDialog({ kind: 'party-editor' }),
    openLedger: (character: PartyCharacter) =>
      setDialog({ kind: 'character-ledger', character }),
    editGroup: (group: SceneGroup) =>
      setDialog({ kind: 'group-editor', group, reinforcement: false }),
    manageGroups: () =>
      setDialog({ kind: 'group-editor', group: null, reinforcement: false }),
    reinforce: () =>
      setDialog({ kind: 'group-editor', group: null, reinforcement: true }),
    createLoot: (anchor: TreasureAnchor) =>
      setDialog({ kind: 'treasure-editor', anchor, treasure: null }),
    editLoot: (treasure: Treasure) =>
      setDialog({
        kind: 'treasure-editor',
        anchor: treasure.anchor,
        treasure
      }),
    distribute: (treasure: Treasure) =>
      setDialog({ kind: 'reward-distribution', treasure })
  } as const
}
