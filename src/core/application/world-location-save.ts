import {
  saveWorldLocationInputSchema,
  worldLocationSaveReceiptSchema,
  type SaveWorldLocationInput,
  type WorldLocationSaveReceipt
} from '../../shared/contracts/world-location.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { WorldLocationStore } from '../worldplanner/location-store.js'
import type { WorldLocationSaveJournal } from '../worldplanner/world-location-save-journal.js'
import type { HexBrushStrokeResult } from '../../shared/contracts/hex.js'
import type { WorldLocationPlacementService } from './world-location-placement.js'

export type WorldLocationSaveContext = Readonly<{
  locations: Pick<WorldLocationStore, 'create' | 'update'>
  journal: Pick<WorldLocationSaveJournal, 'begin' | 'complete' | 'receipt'>
  placement: Pick<WorldLocationPlacementService, 'execute'>
}>

export type WorldLocationSaveExecution = Readonly<{
  receipt: WorldLocationSaveReceipt
  hexResult: HexBrushStrokeResult | null
}>

/**
 * Persists the World Planner base mutation before attempting Hex placement.
 * The provisional receipt is committed with the base mutation so an interrupted
 * operation can be inspected and explicitly resumed without replaying the base.
 */
export class WorldLocationSaveCommandHandler {
  constructor(private readonly createContext: () => WorldLocationSaveContext) {}

  execute(raw: unknown): WorldLocationSaveExecution {
    const input = saveWorldLocationInputSchema.parse(raw)
    const context = this.createContext()
    const current = this.begin(context, input)
    if (current.status === 'saved') return { receipt: current, hexResult: null }

    const placement = context.placement.execute({
      commandId: input.commandId,
      locationId: current.saved.id,
      placement: input.placement
    })
    const receipt =
      placement.result.status === 'rejected'
        ? worldLocationSaveReceiptSchema.parse({
            status: 'partially-saved',
            commandId: input.commandId,
            snapshot: current.snapshot,
            saved: current.saved,
            placementFailure: placement.result.failure
          })
        : worldLocationSaveReceiptSchema.parse({
            status: 'saved',
            commandId: input.commandId,
            snapshot: current.snapshot,
            saved: current.saved,
            placement: placement.result.status
          })
    return {
      receipt: context.journal.complete(input.commandId, receipt),
      hexResult: placement.hexResult
    }
  }

  receipt(commandId: string): WorldLocationSaveReceipt | null {
    return this.createContext().journal.receipt(commandId)
  }

  private begin(
    context: WorldLocationSaveContext,
    input: SaveWorldLocationInput
  ): WorldLocationSaveReceipt {
    return context.journal.begin(input, () =>
      input.locationId
        ? updateLocation(context.locations, input)
        : createLocation(context.locations, input)
    )
  }
}

function createLocation(
  locations: WorldLocationSaveContext['locations'],
  input: SaveWorldLocationInput
) {
  return locations.create(input.location, input.expectedRevision)
}

function updateLocation(
  locations: WorldLocationSaveContext['locations'],
  input: SaveWorldLocationInput
) {
  const id = input.locationId
  if (!id) throw new CapabilityError('validation_failed', false)
  return locations.update(id, input.location, input.expectedRevision)
}
