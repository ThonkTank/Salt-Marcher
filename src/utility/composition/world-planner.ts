import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type { BiomeCatalogService } from '../../core/application/biome-catalog-service.js'
import type { EncounterSourceService } from '../../core/application/encounter-source-service.js'
import type { LocationSymbolLifecycleService } from '../../core/application/location-symbol-lifecycle.js'
import type { WorldLocationDeletionCommandHandler } from '../../core/application/world-location-deletion.js'
import type { WorldLocationPlacementService } from '../../core/application/world-location-placement.js'
import type { WorldLocationSaveCommandHandler } from '../../core/application/world-location-save.js'
import type { WorldLocationService } from '../../core/worldplanner/location-store.js'

type WorldPlannerHandlerName =
  | 'locations.read'
  | 'locations.suggestTags'
  | 'locations.save'
  | 'locations.saveReceipt'
  | 'locations.commitPlacement'
  | 'locations.updateMapPresentation'
  | 'locations.delete'
  | 'locationSymbols.create'
  | 'locationSymbols.search'
  | 'locationSymbols.detail'
  | 'locationSymbols.update'
  | 'locationSymbols.deleteImpact'
  | 'locationSymbols.delete'
  | 'locationSymbols.importAndAssign'
  | 'encounterTables.read'
  | 'encounterTables.commandReceipt'
  | 'encounterTables.create'
  | 'encounterTables.update'
  | 'encounterTables.delete'
  | 'factions.read'
  | 'factions.commandReceipt'
  | 'factions.create'
  | 'factions.update'
  | 'factions.delete'
  | 'npcs.read'
  | 'npcs.commandReceipt'
  | 'npcs.create'
  | 'npcs.update'
  | 'npcs.delete'

export function createWorldPlannerHandlers(dependencies: {
  locations: WorldLocationService
  save: WorldLocationSaveCommandHandler
  placement: WorldLocationPlacementService
  deletion: WorldLocationDeletionCommandHandler
  symbols: LocationSymbolLifecycleService
  sources: EncounterSourceService
  biomes: BiomeCatalogService
  mutateReferences: <T>(work: () => T) => T
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
}): Pick<CoreHandlers, WorldPlannerHandlerName> {
  const {
    locations,
    save,
    placement,
    deletion,
    symbols,
    sources,
    biomes,
    mutateReferences,
    publishLocationChange,
    publishLocationMarkerHexChanges,
    publishSymbolChange,
    publishEncounterTableChange,
    publishBiomeChange,
    publishHexChange,
    publishHexNotice,
    publishNpcChange
  } = dependencies
  const locationSymbols = symbols.symbols
  return {
    'locations.read': () => locations.read(),
    'locations.suggestTags': (input) =>
      locations.suggestTags(input.query, input.limit),
    'locations.save': (input) =>
      mutateReferences(() => {
        const execution = save.execute(input)
        publishLocationChange([execution.receipt.saved.id], 'catalog')
        if (execution.hexResult) publishHexChange(execution.hexResult)
        return execution.receipt
      }),
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
      mutateReferences(() => {
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
        return result.receipt
      }),
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
      mutateReferences(() =>
        sources.createFaction(
          input.commandId,
          input.faction,
          input.expectedRevision
        )
      ),
    'factions.update': (input) =>
      mutateReferences(() =>
        sources.updateFaction(
          input.commandId,
          input.id,
          input.faction,
          input.expectedRevision
        )
      ),
    'factions.delete': (input) =>
      mutateReferences(() => {
        const linkedNpcIds = sources
          .readNpcs()
          .npcs.filter((npc) => npc.factionId === input.id)
          .map((npc) => npc.id)
        const result = sources.deleteFaction(
          input.commandId,
          input.id,
          input.expectedRevision
        )
        if (linkedNpcIds.length > 0)
          publishNpcChange(linkedNpcIds, 'reference-unlinked')
        return result
      }),
    'npcs.read': () => sources.readNpcs(),
    'npcs.commandReceipt': (input) => sources.npcReceipt(input.commandId),
    'npcs.create': (input) =>
      mutateReferences(() => {
        const result = sources.createNpc(
          input.commandId,
          input.npc,
          input.expectedRevision,
          input.expectedFactionRevision
        )
        publishNpcChange([result.saved.id], 'created')
        return result
      }),
    'npcs.update': (input) =>
      mutateReferences(() => {
        const result = sources.updateNpc(
          input.commandId,
          input.id,
          input.npc,
          input.expectedRevision,
          input.expectedFactionRevision
        )
        publishNpcChange([result.saved.id], 'updated')
        return result
      }),
    'npcs.delete': (input) =>
      mutateReferences(() => {
        const result = sources.deleteNpc(
          input.commandId,
          input.id,
          input.expectedRevision,
          input.expectedFactionRevision
        )
        publishNpcChange([result.deletedId], 'deleted')
        return result
      })
  }
}
