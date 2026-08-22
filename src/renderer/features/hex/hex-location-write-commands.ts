import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { queueHexCommand } from './hex-command-outcome.js'
import {
  placementFailureMessage,
  type HexCommandProjectionContext
} from './hex-command-projection.js'
import type { HexCommandTransport } from './hex-command-transport.js'

export type WorldLocationPlacementOutcome =
  | Readonly<{ status: 'placed'; coordinate: AxialCoordinate }>
  | Readonly<{
      status: 'skipped'
      reason:
        | 'map_missing'
        | 'selection_missing'
        | 'tile_missing'
        | 'occupied'
        | 'stale'
    }>
  | Readonly<{ status: 'rejected'; message: string }>
  | Readonly<{ status: 'failed'; message: string }>

export function createHexLocationWriteCommands(dependencies: {
  coordinator: AsyncCommandCoordinator
  transport: HexCommandTransport
  read: () => HexCommandProjectionContext
}) {
  const { coordinator, transport, read } = dependencies

  const placeLocation = async (
    locationId = read().editor.locationId,
    coordinate = read().editor.selected
  ): Promise<WorldLocationPlacementOutcome> => {
    const context = read()
    const current = context.maps.mapRef.current
    if (!current) return { status: 'skipped', reason: 'map_missing' }
    if (!coordinate || !locationId)
      return { status: 'skipped', reason: 'selection_missing' }
    const mapId = current.map.id
    const target = current.tiles.find(
      (tile) => tile.q === coordinate.q && tile.r === coordinate.r
    )
    if (
      !target ||
      (target.location && target.location.locationId !== locationId)
    )
      return {
        status: 'skipped',
        reason: !target ? 'tile_missing' : 'occupied'
      }
    const outcome = await queueHexCommand(
      coordinator,
      `map:${mapId}`,
      () =>
        transport.commitLocationPlacement(locationId, {
          kind: 'place',
          target: { mapId, coordinate }
        }),
      async (result) => {
        if (result.status === 'rejected') return
        const latest = read()
        await latest.maps.refreshCatalog(
          latest.maps.mapRef.current?.map.id ?? mapId
        )
      }
    )
    if (outcome.status === 'success')
      return outcome.value.status === 'rejected'
        ? {
            status: 'rejected',
            message: placementFailureMessage(outcome.value.failure)
          }
        : { status: 'placed', coordinate }
    if (outcome.status === 'stale')
      return { status: 'skipped', reason: 'stale' }
    return { status: 'failed', message: capabilityErrorText(outcome.cause) }
  }

  const removeLocation = async (): Promise<void> => {
    const context = read()
    const current = context.maps.mapRef.current
    const selected = context.editor.selected
    if (!current || !selected) return
    const mapId = current.map.id
    const target = current.tiles.find(
      (tile) => tile.q === selected.q && tile.r === selected.r
    )
    if (!target?.location) return
    const locationId = target.location.locationId
    const outcome = await queueHexCommand(
      coordinator,
      `map:${mapId}`,
      () => transport.commitLocationPlacement(locationId, { kind: 'remove' }),
      async (result) => {
        if (result.status === 'rejected') {
          read().onError(placementFailureMessage(result.failure))
          return
        }
        const latest = read()
        await latest.maps.refreshCatalog(
          latest.maps.mapRef.current?.map.id ?? mapId
        )
      }
    )
    if (outcome.status === 'failure')
      read().onError(capabilityErrorText(outcome.cause))
  }

  return Object.freeze({ placeLocation, removeLocation })
}
