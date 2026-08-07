import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import type {
  WorldLocation,
  WorldLocationDraft,
  WorldLocationPlacementCommitResult as SharedWorldLocationPlacementCommitResult,
  WorldLocationPlacementFailure as SharedWorldLocationPlacementFailure,
  WorldLocationPlacementIntent as SharedWorldLocationPlacementIntent,
  WorldLocationPlacementSelection as SharedWorldLocationPlacementSelection
} from '../../../shared/contracts/world-location.js'
import type { ReactNode } from 'react'

export type WorldLocationEditorResource<Value> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; message: string; retry: () => void }>
  | Readonly<{ status: 'ready'; value: Value }>

export type WorldLocationEditorReferences = Readonly<{
  factions: WorldLocationEditorResource<readonly WorldFaction[]>
  tables: WorldLocationEditorResource<readonly EncounterTable[]>
}>

export type WorldLocationSubmitResult =
  | Readonly<{ status: 'saved' }>
  | Readonly<{
      status: 'partially-saved'
      placementFailure: WorldLocationPlacementFailure
      retry: WorldLocationPlacementRetry
    }>
  | Readonly<{ status: 'failed'; message: string }>

export type WorldLocationMapCoordinate = Readonly<{ q: number; r: number }>

export type WorldLocationPlacementSelection =
  SharedWorldLocationPlacementSelection

export type WorldLocationPlacementHint = Readonly<{
  mapId: string
  coordinate: WorldLocationMapCoordinate | null
}>

export type WorldLocationPlacementState = Readonly<{
  viewedMapId: string | null
  placementDraft: Readonly<{
    baseline: WorldLocationPlacementSelection | null
    current: WorldLocationPlacementSelection | null
  }>
}>

export type WorldLocationPlacementIntent = SharedWorldLocationPlacementIntent

export type WorldLocationPlacementFailure = SharedWorldLocationPlacementFailure

export type WorldLocationPlacementCommitResult =
  SharedWorldLocationPlacementCommitResult

export type WorldLocationPlacementRetry =
  () => Promise<WorldLocationPlacementCommitResult>

export type WorldLocationMapFieldProps = Readonly<{
  locationId: string | null
  locationName: string
  disabled: boolean
  initialHint: WorldLocationPlacementHint | null
  state: WorldLocationPlacementState | null
  onReady: (state: WorldLocationPlacementState) => void
  onViewMap: (mapId: string | null) => void
  onChange: (selection: WorldLocationPlacementSelection | null) => void
}>

export type WorldLocationEditorRenderProps = Readonly<{
  location: WorldLocation | null
  references: WorldLocationEditorReferences
  initialPlacementHint?: WorldLocationPlacementHint | null
  close: () => void
  onError: (message: string) => void
  save: (
    draft: WorldLocationDraft,
    placement: WorldLocationPlacementIntent
  ) => Promise<WorldLocationSubmitResult>
  relatedCreation?: WorldLocationRelatedCreation
}>

export type WorldLocationRelatedCreation = Readonly<{
  requestFactionCreation: (created: (faction: WorldFaction) => void) => void
  requestTableCreation: (created: (table: EncounterTable) => void) => void
}>

export type WorldLocationPlacementDialogRenderProps = Readonly<{
  location: WorldLocation
  close: () => void
  onPlaced: () => void
  onError: (message: string) => void
}>

export type WorldLocationEditingIntegration = Readonly<{
  placementFailureText: (failure: WorldLocationPlacementFailure) => string
  renderEditor: (props: WorldLocationEditorRenderProps) => ReactNode
  renderPlacementDialog: (
    props: WorldLocationPlacementDialogRenderProps
  ) => ReactNode
}>

function sameSelection(
  left: WorldLocationPlacementSelection | null,
  right: WorldLocationPlacementSelection | null
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.mapId === right.mapId &&
      left.coordinate.q === right.coordinate.q &&
      left.coordinate.r === right.coordinate.r)
  )
}

export function worldLocationPlacementIntent(
  state: WorldLocationPlacementState | null
): WorldLocationPlacementIntent {
  if (
    !state ||
    sameSelection(state.placementDraft.baseline, state.placementDraft.current)
  )
    return { kind: 'keep' }
  if (state.placementDraft.current)
    return { kind: 'place', target: state.placementDraft.current }
  return state.placementDraft.baseline ? { kind: 'remove' } : { kind: 'keep' }
}
