import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type { HexChangedChunk } from '../../shared/contracts/hex.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  BiomeCatalogService,
  BiomeMapChange
} from '../../core/application/biome-catalog-service.js'
import type { HexMapEditingCommandHandler } from '../../core/application/hex-map-editing.js'
import type { HexMapService } from '../../core/hex/hex-map-store.js'
import type { HexTravelService } from '../../core/hex/hex-travel.js'
import type { WorldLocationService } from '../../core/worldplanner/location-store.js'

type HexHandlerName =
  | 'hex.biomeCatalog'
  | 'hex.editorBootstrap'
  | 'hex.catalog'
  | 'hex.locateLocation'
  | 'hex.readChunks'
  | 'hex.replaceBiomePlaceholder'
  | 'hex.create'
  | 'hex.update'
  | 'hex.applyBrushStroke'
  | 'hex.history'
  | 'hex.undo'
  | 'hex.redo'
  | 'hex.commandReceipt'
  | 'hex.runtimeOverlays'

export function createHexHandlers(dependencies: {
  hex: HexMapService
  editing: HexMapEditingCommandHandler
  travel: HexTravelService
  biomes: BiomeCatalogService
  locations: WorldLocationService
  changedChunks: (
    mapId: string,
    changes: readonly BiomeMapChange[]
  ) => HexChangedChunk[]
  publishNotice: (
    commandId: string,
    mapIds: readonly string[],
    chunks: readonly HexChangedChunk[]
  ) => void
}): Pick<CoreHandlers, HexHandlerName> {
  const { hex, editing, travel, biomes, locations, publishNotice } =
    dependencies
  const biomeCatalog = () => biomes.hexCatalog()
  return {
    'hex.editorBootstrap': () => ({
      catalog: hex.catalog(),
      biomes: biomeCatalog(),
      locations: locations.read()
    }),
    'hex.biomeCatalog': () => biomeCatalog(),
    'hex.catalog': () => hex.catalog(),
    'hex.locateLocation': (input) => hex.locateLocation(input.locationId),
    'hex.readChunks': (input) => {
      const result = hex.readChunks(input.mapId, input.keys)
      const biomeIds = result.chunks.flatMap((chunk) =>
        chunk.authoredTiles.map((tile) => tile.biomeId)
      )
      return {
        ...result,
        biomes: biomes.hexCatalog(biomeIds).biomes
      }
    },
    'hex.replaceBiomePlaceholder': (input) => {
      const changes = biomes.replaceMapPlaceholder(input)
      const summary = hex.catalog().maps.find((map) => map.id === input.mapId)
      if (!summary) throw new CapabilityError('not_found', false)
      const changedChunks = dependencies.changedChunks(input.mapId, changes)
      if (changes.length > 0)
        publishNotice(input.commandId, [input.mapId], changedChunks)
      return {
        commandId: input.commandId,
        mapId: input.mapId,
        contentRevision: summary.contentRevision,
        affectedTileCount: changes.reduce(
          (total, change) => total + change.affectedTileCount,
          0
        ),
        changedChunks
      }
    },
    'hex.create': (input) => editing.createMap(input),
    'hex.update': (input) => editing.updateMap(input),
    'hex.applyBrushStroke': (input) => {
      if (input.mode === 'paint') {
        if (input.biomeId === null)
          throw new CapabilityError('validation_failed', false)
        const definition = biomes.catalog.require(input.biomeId)
        if (definition.kind === 'placeholder')
          throw new CapabilityError('validation_failed', false)
      }
      return editing.applyBrushStroke(input)
    },
    'hex.history': (input) => editing.history(input.mapId),
    'hex.undo': (input) => editing.undo(input),
    'hex.redo': (input) => editing.redo(input),
    'hex.commandReceipt': (input) => editing.commandReceipt(input.commandId),
    'hex.runtimeOverlays': (input) => travel.runtimeOverlays(input.mapId)
  }
}
