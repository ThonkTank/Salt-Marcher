import type { Creature } from '../../../shared/contracts/encounter.js'
import type {
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDraft,
  WorldFactionMutationReceipt
} from '../../../shared/contracts/encounter-source.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import type { EncounterTableSaveResult } from '../encounter-table/encounter-table-editor-types.js'

export type WorldFactionSaveResult = WorldFactionMutationReceipt

export type CreatureFactsPort = Readonly<{
  detail: CreatureCapabilityPort['detail']
}>

/** Generic render contract used by catalog and nested workspace flows. */
export type WorldFactionEditorRenderProps = Readonly<{
  faction: WorldFaction | null
  tableSnapshot: EncounterTableSnapshot
  close: () => void
  save: (draft: WorldFactionDraft) => Promise<WorldFactionSaveResult>
  saved: (result: WorldFactionSaveResult) => void
  requestTableCreation: (
    saved: (result: EncounterTableSaveResult) => void
  ) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
  creatures: CreatureFactsPort
  invocation:
    Readonly<{ kind: 'catalog' }> | Readonly<{ kind: 'location-link' }>
}>
