import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { executeRecoverableHexCommand } from './hex-command-executor.js'

type PlacementCommand = Readonly<{
  commandId: string
  mapId: string
  locationId: string
  coordinate: AxialCoordinate
  expectedContentRevision: number
}>

type RemovalCommand = Readonly<Omit<PlacementCommand, 'coordinate'>>

/** Shared write/receipt policy for every renderer location-placement surface. */
export function createHexLocationPlacementController(
  hex: SaltMarcherApi['hex']
) {
  return {
    async place(command: PlacementCommand) {
      return executeRecoverableHexCommand(
        command.commandId,
        () => hex.placeLocation(command),
        hex.commandReceipt
      )
    },
    async remove(command: RemovalCommand) {
      return executeRecoverableHexCommand(
        command.commandId,
        () => hex.removeLocation(command),
        hex.commandReceipt
      )
    }
  }
}

export type HexLocationPlacementController = ReturnType<
  typeof createHexLocationPlacementController
>
