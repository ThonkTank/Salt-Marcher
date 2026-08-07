import type { HexBrushStrokeResult } from '../../shared/contracts/hex.js'
import {
  worldLocationPlacementCommandSchema,
  worldLocationPlacementCommitResultSchema,
  type WorldLocationPlacementCommand,
  type WorldLocationPlacementCommitResult,
  type WorldLocationPlacementFailure
} from '../../shared/contracts/world-location.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { HexMapEditingCommandHandler } from './hex-map-editing.js'
import type { HexMapStore } from '../hex/hex-map-store.js'

export type WorldLocationPlacementContext = Readonly<{
  maps: Pick<HexMapStore, 'locateLocation' | 'summary'>
  hexEditing: Pick<
    HexMapEditingCommandHandler,
    'placeLocation' | 'removeLocation'
  >
}>

export type WorldLocationPlacementExecution = Readonly<{
  result: WorldLocationPlacementCommitResult
  hexResult: HexBrushStrokeResult | null
}>

/** Canonical utility-side placement policy used by saves and direct placement. */
export class WorldLocationPlacementService {
  constructor(
    private readonly createContext: () => WorldLocationPlacementContext
  ) {}

  execute(raw: unknown): WorldLocationPlacementExecution {
    const input = worldLocationPlacementCommandSchema.parse(raw)
    if (input.placement.kind === 'keep')
      return { result: { status: 'unchanged' }, hexResult: null }
    try {
      return input.placement.kind === 'remove'
        ? this.remove(input)
        : this.place(input)
    } catch (cause) {
      return {
        result: worldLocationPlacementCommitResultSchema.parse({
          status: 'rejected',
          failure: capabilityFailure(cause)
        }),
        hexResult: null
      }
    }
  }

  private remove(
    input: WorldLocationPlacementCommand
  ): WorldLocationPlacementExecution {
    const context = this.createContext()
    const existing = context.maps.locateLocation(input.locationId)
    if (!existing) return applied(null)
    return executeWithOneStaleRetry(() => {
      const current = this.createContext()
      const placement = current.maps.locateLocation(input.locationId)
      if (!placement) return null
      return current.hexEditing.removeLocation({
        commandId: input.commandId,
        mapId: placement.mapId,
        locationId: input.locationId,
        expectedContentRevision: placement.contentRevision
      })
    })
  }

  private place(
    input: WorldLocationPlacementCommand
  ): WorldLocationPlacementExecution {
    const target =
      input.placement.kind === 'place' ? input.placement.target : null
    if (!target) return applied(null)
    return executeWithOneStaleRetry(() => {
      const context = this.createContext()
      let map
      try {
        map = context.maps.summary(target.mapId)
      } catch (cause) {
        if (cause instanceof CapabilityError && cause.code === 'not_found')
          return { missingMap: true } as const
        throw cause
      }
      return context.hexEditing.placeLocation({
        commandId: input.commandId,
        mapId: target.mapId,
        locationId: input.locationId,
        coordinate: target.coordinate,
        expectedContentRevision: map.contentRevision
      })
    })
  }
}

type PlacementAttempt =
  HexBrushStrokeResult | null | Readonly<{ missingMap: true }>

function executeWithOneStaleRetry(
  execute: () => PlacementAttempt
): WorldLocationPlacementExecution {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = execute()
      if (result === null) return applied(null)
      if ('missingMap' in result) return rejected({ kind: 'map-missing' }, null)
      if (result.status === 'applied') return applied(result)
      if (result.status === 'rejected')
        return rejected(rejectedFailure(result.reason), result)
      return rejected({ kind: 'conflict' }, result)
    } catch (cause) {
      if (
        attempt === 0 &&
        cause instanceof CapabilityError &&
        cause.code === 'stale'
      )
        continue
      throw cause
    }
  }
  return rejected({ kind: 'stale' }, null)
}

function applied(
  hexResult: HexBrushStrokeResult | null
): WorldLocationPlacementExecution {
  return { result: { status: 'applied' }, hexResult }
}

function rejected(
  failure: WorldLocationPlacementFailure,
  hexResult: HexBrushStrokeResult | null
): WorldLocationPlacementExecution {
  return { result: { status: 'rejected', failure }, hexResult }
}

function rejectedFailure(
  reason: Extract<HexBrushStrokeResult, { status: 'rejected' }>['reason']
): WorldLocationPlacementFailure {
  return {
    kind:
      reason === 'location_occupied'
        ? 'occupied'
        : reason === 'tile_missing'
          ? 'tile-missing'
          : reason === 'location_not_placed'
            ? 'location-not-placed'
            : 'conflict'
  }
}

function capabilityFailure(cause: unknown): WorldLocationPlacementFailure {
  if (!(cause instanceof CapabilityError)) return { kind: 'unavailable' }
  if (cause.code === 'stale') return { kind: 'stale' }
  if (cause.code === 'not_found') return { kind: 'map-missing' }
  return { kind: 'unavailable', detail: cause.code }
}
