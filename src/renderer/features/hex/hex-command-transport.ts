import type {
  ApplyHexBrushStrokeInput,
  HexBrushStrokeResult
} from '../../../shared/contracts/hex.js'
import type { WorldLocationPlacementIntent } from '../../../shared/contracts/world-location.js'
import type { HexCapabilities } from './hex-capabilities.js'
import { executeRecoverableHexCommand } from './hex-command-executor.js'
import {
  createHexMapApplicationPort,
  type HexMapCreationResult
} from './hex-map-creation-port.js'
import { createWorldLocationPlacementCommitter } from './world-location-placement-commit.js'

type MetadataInput = Parameters<HexCapabilities['hex']['updateMetadata']>[0]
type HistoryInput = Parameters<HexCapabilities['hex']['undo']>[0]

export type HexCommandTransport = Readonly<{
  createMap: (displayName: string) => Promise<HexMapCreationResult>
  updateMetadata: (input: MetadataInput) => Promise<HexBrushStrokeResult>
  changeHistory: (
    direction: 'undo' | 'redo',
    input: HistoryInput
  ) => Promise<HexBrushStrokeResult>
  applyBrushStroke: (
    input: ApplyHexBrushStrokeInput
  ) => Promise<HexBrushStrokeResult>
  commitLocationPlacement: ReturnType<
    typeof createWorldLocationPlacementCommitter
  >
}>

/** Owns preload transport calls and receipt recovery for Hex writes. */
export function createHexCommandTransport(
  capabilities: HexCapabilities,
  invalidateMap: (mapId: string) => void
): HexCommandTransport {
  const creation = createHexMapApplicationPort({ hex: capabilities.hex })
  const commitLocationPlacement =
    createWorldLocationPlacementCommitter(capabilities)
  const recover = (
    commandId: string,
    execute: () => Promise<HexBrushStrokeResult>,
    receiptFailure?: () => void
  ) =>
    executeRecoverableHexCommand(
      commandId,
      execute,
      (receiptId) => capabilities.hex.commandReceipt(receiptId),
      receiptFailure
    )

  return Object.freeze({
    createMap: creation.createMap,
    updateMetadata: (input) =>
      recover(input.commandId, () => capabilities.hex.updateMetadata(input)),
    changeHistory: (direction, input) =>
      recover(input.commandId, () => capabilities.hex[direction](input)),
    applyBrushStroke: (input) =>
      recover(
        input.commandId,
        () => capabilities.hex.applyBrushStroke(input),
        () => invalidateMap(input.mapId)
      ),
    commitLocationPlacement: (
      locationId: string,
      placement: WorldLocationPlacementIntent
    ) => commitLocationPlacement(locationId, placement)
  })
}
