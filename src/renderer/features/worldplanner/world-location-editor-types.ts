import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import type { AxialCoordinate } from '../../../shared/contracts/hex.js'

export type WorldLocationEditorReferences =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; message: string; retry: () => void }>
  | Readonly<{
      status: 'ready'
      factions: readonly WorldFaction[]
      tables: readonly EncounterTable[]
    }>

export type WorldLocationSubmitResult =
  | Readonly<{ status: 'saved' }>
  | Readonly<{ status: 'failed'; message: string }>

export type WorldLocationPlacementOutcome =
  | Readonly<{ status: 'placed'; coordinate: AxialCoordinate }>
  | Readonly<{
      status: 'skipped'
      reason: 'map_missing' | 'selection_missing' | 'tile_missing' | 'occupied'
    }>
  | Readonly<{ status: 'rejected'; message: string }>
  | Readonly<{ status: 'failed'; message: string }>
