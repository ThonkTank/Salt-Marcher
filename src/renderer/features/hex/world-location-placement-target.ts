import type {
  AxialCoordinate,
  HexMapView
} from '../../../shared/contracts/hex.js'

export type AutomaticLocationPlacementTarget =
  | Readonly<{ status: 'eligible'; coordinate: AxialCoordinate }>
  | Readonly<{
      status: 'skipped'
      reason: 'map_missing' | 'selection_missing' | 'tile_missing' | 'occupied'
    }>

export function automaticLocationPlacementTarget(
  map: HexMapView | null,
  selected: AxialCoordinate | null
): AutomaticLocationPlacementTarget {
  if (!map) return { status: 'skipped', reason: 'map_missing' }
  if (!selected) return { status: 'skipped', reason: 'selection_missing' }
  const tile = map.tiles.find(
    (candidate) => candidate.q === selected.q && candidate.r === selected.r
  )
  if (!tile) return { status: 'skipped', reason: 'tile_missing' }
  if (tile.location) return { status: 'skipped', reason: 'occupied' }
  return { status: 'eligible', coordinate: selected }
}
