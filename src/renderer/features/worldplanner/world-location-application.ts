import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import type {
  SaveWorldLocationInput,
  WorldLocation,
  WorldLocationDraft,
  WorldLocationPlacementIntent,
  WorldLocationSaveReceipt,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import { worldLocationDraftSchema } from '../../../shared/contracts/world-location.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { encounterTables } from '../encounter-table/encounter-table-snapshot.js'
import type { WorldLocationPlacementCommitResult } from './world-location-editor-types.js'

export type WorldLocationApplicationSaveResult = Readonly<{
  receipt: WorldLocationSaveReceipt
  retryPlacement: () => Promise<WorldLocationPlacementCommitResult>
}>

export type WorldLocationApplicationPort = Readonly<{
  readLocations(): Promise<WorldLocationSnapshot>
  readFactions(): Promise<readonly WorldFaction[]>
  readTables(): Promise<readonly EncounterTable[]>
  save(
    location: WorldLocation | null,
    draft: WorldLocationDraft,
    placement: WorldLocationPlacementIntent
  ): Promise<WorldLocationApplicationSaveResult>
  remove(location: WorldLocation): Promise<WorldLocationSnapshot>
}>

export function createWorldLocationApplicationPort(
  api: Pick<SaltMarcherApi, 'locations' | 'factions' | 'encounterTables'>
): WorldLocationApplicationPort {
  let locations: WorldLocationSnapshot | null = null

  const accept = (candidate: WorldLocationSnapshot) => {
    if (!locations || candidate.revision >= locations.revision)
      locations = candidate
    return locations
  }
  const readLocations = async () => accept(await api.locations.read())
  const currentLocations = async () => locations ?? readLocations()

  const apply = async (
    input: SaveWorldLocationInput
  ): Promise<WorldLocationSaveReceipt> => {
    let receipt: WorldLocationSaveReceipt
    try {
      receipt = await api.locations.save(input)
    } catch (cause) {
      if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
      const recovered = await api.locations.saveReceipt(input.commandId)
      if (!recovered) throw cause
      receipt = recovered
    }
    accept(receipt.snapshot)
    return receipt
  }

  return {
    readLocations,
    readFactions: async () => (await api.factions.read()).factions,
    readTables: async () => encounterTables(await api.encounterTables.read()),
    save: async (location, draft, placement) => {
      const known = await currentLocations()
      const input: SaveWorldLocationInput = {
        commandId: crypto.randomUUID(),
        locationId: location?.id ?? null,
        location: worldLocationDraftSchema.parse(draft),
        expectedRevision: known.revision,
        placement
      }
      const receipt = await apply(input)

      return {
        receipt,
        retryPlacement: async () => {
          const retried = await apply(input)
          return retried.status === 'partially-saved'
            ? { status: 'rejected', failure: retried.placementFailure }
            : { status: retried.placement }
        }
      }
    },
    remove: async (location) => {
      const known = await currentLocations()
      const receipt = await api.locations.delete(location.id, known.revision)
      return accept(receipt.snapshot)
    }
  }
}
