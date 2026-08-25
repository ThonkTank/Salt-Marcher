import { encounterTablesOperationDefinitions } from '../../shared/contracts/operations/encounter-tables.js'
import { factionsOperationDefinitions } from '../../shared/contracts/operations/factions.js'
import { locationSymbolsOperationDefinitions } from '../../shared/contracts/operations/location-symbols.js'
import { locationsOperationDefinitions } from '../../shared/contracts/operations/locations.js'
import { npcsOperationDefinitions } from '../../shared/contracts/operations/npcs.js'
import {
  composeOperationDefinitions,
  defineOperationHandlers,
  type OperationHandlers
} from '../../shared/contracts/operations/registry.js'
import type { BiomeCatalogService } from '../../core/application/biome-catalog-service.js'
import type { EncounterSourceService } from '../../core/application/encounter-source-service.js'
import type { LocationSymbolLifecycleService } from '../../core/application/location-symbol-lifecycle.js'
import type { WorldLocationDeletionCommandHandler } from '../../core/application/world-location-deletion.js'
import type { WorldLocationPlacementService } from '../../core/application/world-location-placement.js'
import type { WorldLocationSaveCommandHandler } from '../../core/application/world-location-save.js'
import type { WorldLocationService } from '../../core/worldplanner/location-store.js'
import type { WorldNpcApplicationService } from '../../core/application/world-npc-application-service.js'
import type { ReferenceChangeDescriptor } from '../../core/reference/reference-change-coordinator.js'

const worldPlannerHandlerOperations = composeOperationDefinitions(
  locationsOperationDefinitions,
  locationSymbolsOperationDefinitions,
  encounterTablesOperationDefinitions,
  factionsOperationDefinitions,
  npcsOperationDefinitions
)

export function createWorldPlannerHandlers(dependencies: {
  locations: WorldLocationService
  save: WorldLocationSaveCommandHandler
  placement: WorldLocationPlacementService
  deletion: WorldLocationDeletionCommandHandler
  symbols: LocationSymbolLifecycleService
  sources: EncounterSourceService
  worldNpcs: WorldNpcApplicationService
  biomes: BiomeCatalogService
  mutateReferences: <T>(
    work: () => T,
    changes: (result: T) => readonly ReferenceChangeDescriptor[]
  ) => T
  publishSessionProjectionInvalidation: () => void
  publishLocationChange: (
    ids: readonly string[],
    reason: 'catalog' | 'presentation' | 'symbol-replacement'
  ) => void
  publishLocationMarkerHexChanges: (
    ids: readonly string[],
    commandId?: string
  ) => void
  publishSymbolChange: (
    ids: readonly string[],
    reason: 'created' | 'renamed' | 'deleted'
  ) => void
  publishEncounterTableChange: (
    snapshot: ReturnType<EncounterSourceService['readTables']>,
    ids: readonly string[],
    scope: 'installation' | 'campaign',
    reason: 'created' | 'updated' | 'deleted'
  ) => void
  publishBiomeChange: (
    ids: readonly string[],
    reason: 'created' | 'updated' | 'deleted'
  ) => void
  publishHexChange: (payload: unknown) => void
  publishHexNotice: (
    commandId: string,
    mapIds: readonly string[],
    changedChunks: readonly unknown[]
  ) => void
  publishNpcChange: (
    ids: readonly string[],
    reason: 'created' | 'updated' | 'deleted' | 'reference-unlinked'
  ) => void
  publishFactionChange: (
    ids: readonly string[],
    reason: 'created' | 'updated' | 'deleted'
  ) => void
}): OperationHandlers<typeof worldPlannerHandlerOperations> {
  const {
    locations,
    save,
    placement,
    deletion,
    symbols,
    sources,
    worldNpcs,
    biomes,
    mutateReferences,
    publishSessionProjectionInvalidation,
    publishLocationChange,
    publishLocationMarkerHexChanges,
    publishSymbolChange,
    publishEncounterTableChange,
    publishBiomeChange,
    publishHexChange,
    publishHexNotice,
    publishNpcChange,
    publishFactionChange
  } = dependencies
  const locationSymbols = symbols.symbols
  return defineOperationHandlers(
    'world_planner_handlers',
    worldPlannerHandlerOperations,
    {
      'locations.read': () => locations.read(),
      'locations.suggestTags': (input) =>
        locations.suggestTags(input.query, input.limit),
      'locations.save': (input) =>
        mutateReferences(
          () => {
            const execution = save.execute(input)
            publishLocationChange([execution.receipt.saved.id], 'catalog')
            publishSessionProjectionInvalidation()
            if (execution.hexResult) publishHexChange(execution.hexResult)
            return execution.receipt
          },
          (receipt) => [{ kind: 'location', id: receipt.saved.id }]
        ),
      'locations.saveReceipt': (input) => save.receipt(input.commandId),
      'locations.commitPlacement': (input) => {
        const execution = placement.execute(input)
        if (execution.hexResult) publishHexChange(execution.hexResult)
        return execution.result
      },
      'locations.updateMapPresentation': (input) => {
        const result = locations.updateMapPresentation(
          input.id,
          input.patch,
          input.expectedRevision
        )
        publishLocationChange([input.id], 'presentation')
        publishLocationMarkerHexChanges([input.id])
        return result
      },
      'locations.delete': (input) =>
        mutateReferences(
          () => {
            const result = deletion.execute(input)
            if (result.unlinkedNpcIds.length > 0)
              publishNpcChange(result.unlinkedNpcIds, 'reference-unlinked')
            if (result.notice)
              publishHexNotice(
                result.notice.campaignCommandId,
                [result.notice.map.id],
                [result.notice.changedChunk]
              )
            publishLocationChange([input.id], 'catalog')
            publishSessionProjectionInvalidation()
            return result.receipt
          },
          () => [{ kind: 'location', id: input.id }]
        ),
      'locationSymbols.create': (input) => {
        const result = locationSymbols.create(
          input.symbol,
          input.expectedRevision
        )
        publishSymbolChange([result.saved.id], 'created')
        return result
      },
      'locationSymbols.search': (input) =>
        locationSymbols.search(input.query, input.offset, input.limit),
      'locationSymbols.detail': (input) => locationSymbols.detail(input.id),
      'locationSymbols.update': (input) => {
        const result = locationSymbols.update(
          input.id,
          input.displayName,
          input.expectedRevision
        )
        publishSymbolChange([input.id], 'renamed')
        return result
      },
      'locationSymbols.deleteImpact': (input) => symbols.deleteImpact(input.id),
      'locationSymbols.delete': (input) => {
        const result = symbols.delete(input)
        if (result.activeChangedLocationIds.length > 0)
          publishLocationChange(
            result.activeChangedLocationIds,
            'symbol-replacement'
          )
        publishLocationMarkerHexChanges(
          result.activeChangedLocationIds,
          input.commandId
        )
        if (result.status === 'applied')
          publishSymbolChange([input.id], 'deleted')
        return {
          status: result.status,
          commandId: input.commandId,
          symbols: result.symbols
        }
      },
      'locationSymbols.importAndAssign': (input) => {
        const result = symbols.importAndAssign(input)
        if (result.status === 'applied') {
          publishSymbolChange([result.createdSymbolId], 'created')
          publishLocationChange([input.locationId], 'presentation')
          publishLocationMarkerHexChanges([input.locationId], input.commandId)
        }
        return {
          status: result.status,
          commandId: input.commandId,
          symbols: result.symbols,
          presentationRevision: result.presentation.revision
        }
      },
      'encounterTables.read': () => sources.readTables(),
      'encounterTables.commandReceipt': (input) =>
        sources.tableReceipt(input.commandId),
      'encounterTables.create': (input) => {
        const result = sources.createTable(
          input.commandId,
          input.table,
          input.expectedRevision,
          input.scope
        )
        publishEncounterTableChange(
          result.snapshot,
          [result.saved.id],
          input.scope,
          'created'
        )
        return result
      },
      'encounterTables.update': (input) => {
        const result = sources.updateTable(
          input.commandId,
          input.id,
          input.table,
          input.expectedRevision,
          input.scope
        )
        publishEncounterTableChange(
          result.snapshot,
          [result.saved.id],
          input.scope,
          'updated'
        )
        return result
      },
      'encounterTables.delete': (input) => {
        const linkedBiomeIds =
          input.scope === 'installation'
            ? biomes.catalog.biomeIdsUsingEncounterTable(input.id)
            : []
        const result = sources.deleteTable(
          input.commandId,
          input.id,
          input.expectedRevision,
          input.scope
        )
        publishEncounterTableChange(
          result.snapshot,
          [result.deletedId],
          input.scope,
          'deleted'
        )
        if (linkedBiomeIds.length > 0)
          publishBiomeChange(linkedBiomeIds, 'updated')
        return result
      },
      'factions.read': () => sources.readFactions(),
      'factions.commandReceipt': (input) =>
        sources.factionReceipt(input.commandId),
      'factions.create': (input) =>
        mutateReferences(
          () => {
            const result = sources.createFaction(
              input.commandId,
              input.faction,
              input.expectedRevision
            )
            publishFactionChange([result.saved.id], 'created')
            return result
          },
          (receipt) => [{ kind: 'faction', id: receipt.saved.id }]
        ),
      'factions.update': (input) =>
        mutateReferences(
          () => {
            const result = sources.updateFaction(
              input.commandId,
              input.id,
              input.faction,
              input.expectedRevision
            )
            publishFactionChange([result.saved.id], 'updated')
            return result
          },
          () => [{ kind: 'faction', id: input.id }]
        ),
      'factions.delete': (input) =>
        mutateReferences(
          () => {
            const linkedNpcIds = worldNpcs.linkedToFaction(input.id)
            const result = sources.deleteFaction(
              input.commandId,
              input.id,
              input.expectedRevision
            )
            publishFactionChange([input.id], 'deleted')
            if (linkedNpcIds.length > 0) {
              worldNpcs.recordExternalReferenceChange(linkedNpcIds)
              publishNpcChange(linkedNpcIds, 'reference-unlinked')
            }
            return result
          },
          () => [{ kind: 'faction', id: input.id }]
        ),
      'npcs.search': (input) => worldNpcs.search(input),
      'npcs.detail': (input) => worldNpcs.detail(input.id),
      'npcs.commandReceipt': (input) =>
        worldNpcs.commandReceipt(input.commandId),
      'npcs.create': (input) =>
        mutateReferences(
          () => {
            const result = worldNpcs.create(
              input.commandId,
              input.npc,
              input.expectedRevision,
              input.expectedFactionRevision
            )
            publishNpcChange([result.saved.id], 'created')
            return result
          },
          (receipt) => [{ kind: 'npc', id: receipt.saved.id }]
        ),
      'npcs.update': (input) =>
        mutateReferences(
          () => {
            const result = worldNpcs.update(
              input.commandId,
              input.id,
              input.npc,
              input.expectedRevision,
              input.expectedFactionRevision
            )
            publishNpcChange([result.saved.id], 'updated')
            return result
          },
          (receipt) => [{ kind: 'npc', id: receipt.saved.id }]
        ),
      'npcs.delete': (input) =>
        mutateReferences(
          () => {
            const result = worldNpcs.delete(
              input.commandId,
              input.id,
              input.expectedRevision,
              input.expectedFactionRevision
            )
            publishNpcChange([result.deletedId], 'deleted')
            return result
          },
          (receipt) => [{ kind: 'npc', id: receipt.deletedId }]
        )
    }
  )
}
