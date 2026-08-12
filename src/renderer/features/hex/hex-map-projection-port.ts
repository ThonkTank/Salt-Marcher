import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { BiomeChangeNotice } from '../../../shared/contracts/biome.js'
import type {
  AxialCoordinate,
  HexBiomeCatalog,
  HexChangeNotice,
  HexLocationPlacementReference,
  HexMapCatalogSnapshot,
  HexMapView
} from '../../../shared/contracts/hex.js'
import { HexChunkCache } from './hex-chunk-cache.js'
import type { HexCapabilities } from './hex-capabilities.js'

export type HexMapProjectionChange =
  | Readonly<{ kind: 'hex'; notice: HexChangeNotice }>
  | Readonly<{ kind: 'biomes'; notice: BiomeChangeNotice }>

export type HexMapProjectionPort = Readonly<{
  cacheLifetime: 'transient' | 'shared-owner'
  currentCatalog: () => HexMapCatalogSnapshot | null
  currentBiomeCatalog: () => HexBiomeCatalog | null
  readCatalog: () => Promise<HexMapCatalogSnapshot>
  readBiomeCatalog: () => Promise<HexBiomeCatalog>
  readMap: (input: {
    mapId: string
    center?: AxialCoordinate
    force?: boolean
    halfExtent?: number
  }) => Promise<HexMapView>
  locateLocation: (locationId: string) => Promise<HexLocationPlacementReference>
  subscribe: (listener: (change: HexMapProjectionChange) => void) => () => void
  dispose: () => void
}>

/** Owns one transient cache and one normalized Hex/Biome subscription. */
export function createHexMapProjectionPort(
  api:
    | Pick<SaltMarcherApi, 'hex' | 'biomes'>
    | Pick<HexCapabilities, 'hex' | 'biomes'>
): HexMapProjectionPort {
  const cache = new HexChunkCache((mapId, keys) => {
    if ('updateMetadata' in api.hex) return api.hex.readChunks(mapId, [...keys])
    return api.hex.readChunks({ mapId, keys: [...keys] })
  })
  const listeners = new Set<(change: HexMapProjectionChange) => void>()
  let catalog: HexMapCatalogSnapshot | null = null
  let biomes: HexBiomeCatalog | null = null
  const knownMapIds = new Set<string>()
  let disconnect: (() => void) | null = null
  let disposed = false

  const readCatalog = async () => {
    const next = await api.hex.catalog()
    catalog = next
    for (const map of next.maps) knownMapIds.add(map.id)
    return next
  }
  const readBiomeCatalog = async () => {
    const next = await api.hex.biomeCatalog()
    biomes = next
    return next
  }
  const connect = () => {
    if (disconnect || disposed) return
    const disconnectHex = api.hex.onChanged((notice) => {
      for (const mapId of notice.mapIds)
        cache.invalidateChunks(
          mapId,
          notice.changedChunks
            .filter((chunk) => chunk.mapId === mapId)
            .map((chunk) => chunk.key)
        )
      catalog = null
      for (const listener of listeners) listener({ kind: 'hex', notice })
    })
    const disconnectBiomes = api.biomes.onChanged((notice) => {
      for (const mapId of knownMapIds) cache.invalidateMap(mapId)
      biomes = null
      for (const listener of listeners) listener({ kind: 'biomes', notice })
    })
    disconnect = () => {
      disconnectHex()
      disconnectBiomes()
      disconnect = null
    }
  }

  return {
    cacheLifetime: 'transient',
    currentCatalog: () => catalog,
    currentBiomeCatalog: () => biomes,
    readCatalog,
    readBiomeCatalog,
    async readMap(input) {
      const currentCatalog = catalog ?? (await readCatalog())
      const summary = currentCatalog.maps.find((map) => map.id === input.mapId)
      if (!summary) throw new Error(`Unknown hex map ${input.mapId}.`)
      const view = await cache.readMapView(
        summary,
        input.center,
        input.force ?? false,
        input.halfExtent
      )
      catalog = {
        ...currentCatalog,
        maps: currentCatalog.maps.map((map) =>
          map.id === view.map.id ? view.map : map
        )
      }
      knownMapIds.add(view.map.id)
      return view
    },
    locateLocation: (locationId) => {
      if ('updateMetadata' in api.hex) return api.hex.locateLocation(locationId)
      return api.hex.locateLocation({ locationId })
    },
    subscribe(listener) {
      if (disposed) throw new Error('Hex map projection port is disposed.')
      listeners.add(listener)
      connect()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) disconnect?.()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
      disconnect?.()
      cache.clear()
      catalog = null
      biomes = null
      knownMapIds.clear()
    }
  }
}
