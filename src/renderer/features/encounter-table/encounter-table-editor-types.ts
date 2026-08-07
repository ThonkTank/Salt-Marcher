import type { Creature } from '../../../shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableMutationReceipt,
  EncounterTableScope
} from '../../../shared/contracts/encounter-source.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import type { BiomeOptionSearchPort } from '../creatures/biome-option-search-port.js'

export type EncounterTableSaveResult = EncounterTableMutationReceipt

/** Entity-focused contract shared by direct and nested table-dialog callers. */
export type EncounterTableEditorRenderProps = Readonly<{
  table: EncounterTable | null
  close: () => void
  save: (
    table: EncounterTable | null,
    draft: EncounterTableDraft,
    scope: EncounterTableScope
  ) => Promise<EncounterTableSaveResult>
  saved: (result: EncounterTableSaveResult) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
  creaturePort: CreatureCapabilityPort
  biomePort: BiomeOptionSearchPort
  invocation:
    | Readonly<{ kind: 'catalog' }>
    | Readonly<{ kind: 'location-link' }>
    | Readonly<{ kind: 'faction-link' }>
}>
