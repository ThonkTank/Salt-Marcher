import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  CreateWorldLocationResult,
  WorldLocationDraft
} from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'

export type WorldLocationCreationPort = Readonly<{
  readEditorReferences(): Promise<
    Readonly<{
      factions: readonly WorldFaction[]
      tables: readonly EncounterTable[]
    }>
  >
  createLocation(
    draft: WorldLocationDraft,
    expectedRevision: number
  ): Promise<CreateWorldLocationResult>
}>

export function createWorldLocationCreationPort(
  api: SaltMarcherApi
): WorldLocationCreationPort {
  return {
    async readEditorReferences() {
      const [factions, tables] = await Promise.all([
        api.factions.read(),
        api.encounterTables.read()
      ])
      return { factions: factions.factions, tables: tables.tables }
    },
    createLocation: (draft, revision) => api.locations.create(draft, revision)
  }
}
