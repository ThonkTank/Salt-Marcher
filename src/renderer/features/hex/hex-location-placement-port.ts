import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { BiomeChangeNotice } from '../../../shared/contracts/biome.js'
import type {
  HexBiomeCatalog,
  HexChangeNotice,
  HexLocationPlacementReference,
  HexMapCatalogSnapshot
} from '../../../shared/contracts/hex.js'
import { HexChunkCache } from './hex-chunk-cache.js'

export type HexPlacementProjectionChange =
  | Readonly<{ kind: 'hex'; notice: HexChangeNotice }>
  | Readonly<{ kind: 'biomes'; notice: BiomeChangeNotice }>

export type HexLocationPlacementProjectionPort = Readonly<{
  currentCatalog: () => HexMapCatalogSnapshot | null
  currentBiomeCatalog: () => HexBiomeCatalog | null
  readCatalog: () => Promise<HexMapCatalogSnapshot>
  readBiomeCatalog: () => Promise<HexBiomeCatalog>
  locateLocation: (locationId: string) => Promise<HexLocationPlacementReference>
  cache: HexChunkCache
  cacheMode: 'transient' | 'shared-owner'
  subscribe: (
    listener: (change: HexPlacementProjectionChange) => void
  ) => () => void
}>

/** Creates the transient projection owner used outside the Hex workspace. */
export function createHexLocationPlacementProjectionPort(
  api: Pick<SaltMarcherApi, 'hex' | 'biomes'>
): HexLocationPlacementProjectionPort {
  const cache = new HexChunkCache((mapId, keys) =>
    api.hex.readChunks(mapId, keys)
  )
  return {
    currentCatalog: () => null,
    currentBiomeCatalog: () => null,
    readCatalog: () => api.hex.catalog(),
    readBiomeCatalog: () => api.hex.biomeCatalog(),
    locateLocation: (locationId) => api.hex.locateLocation(locationId),
    cache,
    cacheMode: 'transient',
    subscribe: (listener) => {
      const unsubscribeHex = api.hex.onChanged((notice) =>
        listener({ kind: 'hex', notice })
      )
      const unsubscribeBiomes = api.biomes.onChanged((notice) =>
        listener({ kind: 'biomes', notice })
      )
      return () => {
        unsubscribeHex()
        unsubscribeBiomes()
        cache.clear()
      }
    }
  }
}
