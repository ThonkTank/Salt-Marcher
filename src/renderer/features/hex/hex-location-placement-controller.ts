import type {
  AxialCoordinate,
  HexBrushStrokeResult
} from '../../../shared/contracts/hex.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { hexCapabilities } from './hex-capabilities.js'

type PlacementCommand = Readonly<{
  commandId: string
  mapId: string
  locationId: string
  coordinate: AxialCoordinate
  expectedContentRevision: number
}>

type RemovalCommand = Readonly<Omit<PlacementCommand, 'coordinate'>>

/** Shared write/receipt policy for every renderer location-placement surface. */
export function createHexLocationPlacementController() {
  const recover = async (
    commandId: string,
    cause: unknown
  ): Promise<HexBrushStrokeResult> => {
    if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
    const receipt = await hexCapabilities().hex.commandReceipt(commandId)
    if (!receipt) throw cause
    return receipt
  }
  return {
    async place(command: PlacementCommand) {
      try {
        return await hexCapabilities().hex.placeLocation(command)
      } catch (cause) {
        return recover(command.commandId, cause)
      }
    },
    async remove(command: RemovalCommand) {
      try {
        return await hexCapabilities().hex.removeLocation(command)
      } catch (cause) {
        return recover(command.commandId, cause)
      }
    }
  }
}

export type HexLocationPlacementController = ReturnType<
  typeof createHexLocationPlacementController
>
