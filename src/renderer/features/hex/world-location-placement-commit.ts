import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { HexCapabilities } from './hex-capabilities.js'
import type { HexBrushStrokeResult } from '../../../shared/contracts/hex.js'
import type {
  WorldLocationPlacementCommitResult,
  WorldLocationPlacementFailure,
  WorldLocationPlacementIntent
} from '../../../shared/contracts/world-location.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'

export function rejectedLocationPlacementFailure(
  result: HexBrushStrokeResult
): WorldLocationPlacementFailure {
  if (result.status !== 'rejected') return { kind: 'conflict' }
  return {
    kind:
      result.reason === 'location_occupied'
        ? 'occupied'
        : result.reason === 'tile_missing'
          ? 'tile-missing'
          : result.reason === 'location_not_placed'
            ? 'location-not-placed'
            : 'conflict'
  }
}

/** Thin renderer adapter; all map reads and placement policy live in utility. */
export function createWorldLocationPlacementCommitter(
  api:
    | Pick<SaltMarcherApi, 'locations' | 'hex'>
    | Pick<HexCapabilities, 'locations' | 'hex'>
) {
  return async (
    locationId: string,
    placement: WorldLocationPlacementIntent
  ): Promise<WorldLocationPlacementCommitResult> => {
    const commandId = crypto.randomUUID()
    try {
      return await api.locations.commitPlacement({
        commandId,
        locationId,
        placement
      })
    } catch (cause) {
      if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
      const receipt =
        'updateMetadata' in api.hex
          ? await api.hex.commandReceipt(commandId)
          : await api.hex.commandReceipt({ commandId })
      if (!receipt) throw cause
      return receipt.status === 'applied'
        ? { status: 'applied' }
        : receipt.status === 'rejected'
          ? {
              status: 'rejected',
              failure: rejectedLocationPlacementFailure(receipt)
            }
          : { status: 'rejected', failure: { kind: 'conflict' } }
    }
  }
}
