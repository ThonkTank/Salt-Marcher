import {
  type AxialCoordinate,
  type HexBiomeCatalog,
  type HexBiomeDefinition,
  type HexChunkKey,
  type HexChunkSnapshot,
  type HexMapSummary,
  type HexMapView
} from '../../../shared/contracts/hex.js'

const chunkSize = 32
const viewHalfExtent = 64
const maximumChunksPerMap = 256

type ChunkReader = (
  mapId: string,
  keys: readonly HexChunkKey[]
) => Promise<
  Readonly<{
    map: HexMapSummary
    chunks: readonly HexChunkSnapshot[]
    biomes: readonly HexBiomeDefinition[]
  }>
>

export function mergeHexBiomeCatalog(
  catalog: HexBiomeCatalog,
  definitions: readonly HexBiomeDefinition[]
): HexBiomeCatalog {
  const byId = new Map(catalog.biomes.map((biome) => [biome.id, biome]))
  for (const biome of definitions) byId.set(biome.id, biome)
  return { revision: catalog.revision, biomes: [...byId.values()] }
}

export function chunkKeyForCoordinate(
  coordinate: AxialCoordinate
): HexChunkKey {
  return {
    q: Math.floor(coordinate.q / chunkSize),
    r: Math.floor(coordinate.r / chunkSize)
  }
}

export function visibleChunkKeys(
  center: AxialCoordinate,
  halfExtent = viewHalfExtent
): HexChunkKey[] {
  const minimum = chunkKeyForCoordinate({
    q: center.q - halfExtent,
    r: center.r - halfExtent
  })
  const maximum = chunkKeyForCoordinate({
    q: center.q + halfExtent,
    r: center.r + halfExtent
  })
  const keys: HexChunkKey[] = []
  for (let q = minimum.q; q <= maximum.q; q += 1)
    for (let r = minimum.r; r <= maximum.r; r += 1) keys.push({ q, r })
  return keys
}

export class HexChunkCache {
  private readonly cache = new Map<
    string,
    Map<string, { revision: number; snapshot: HexChunkSnapshot }>
  >()
  private readonly loadedContentRevision = new Map<string, number>()
  private readonly staleChunks = new Map<string, Set<string>>()
  private readonly biomeDefinitions = new Map<
    string,
    Map<string, HexBiomeDefinition>
  >()

  constructor(private readonly readChunks: ChunkReader) {}

  async readMapView(
    map: HexMapSummary,
    center: AxialCoordinate = { q: 0, r: 0 },
    force = false,
    halfExtent = viewHalfExtent
  ): Promise<HexMapView> {
    const keys = visibleChunkKeys(center, halfExtent)
    const mapCache = this.cache.get(map.id)
    const stale = this.staleChunks.get(map.id)
    const revisionChanged =
      this.loadedContentRevision.get(map.id) !== map.contentRevision
    const hasExactInvalidation = (stale?.size ?? 0) > 0
    const keysToRead = keys.filter((key) => {
      const id = keyId(key)
      return (
        force ||
        !mapCache?.has(id) ||
        stale?.has(id) ||
        (revisionChanged && !hasExactInvalidation)
      )
    })
    if (keysToRead.length > 0) {
      let currentMap = map
      for (let index = 0; index < keysToRead.length; index += 64) {
        const result = await this.readChunks(
          map.id,
          keysToRead.slice(index, index + 64)
        )
        for (const chunk of result.chunks) this.absorb(map.id, chunk)
        this.absorbBiomes(map.id, result.biomes)
        this.pruneBiomeDefinitions(map.id)
        currentMap = result.map
      }
      this.loadedContentRevision.set(map.id, currentMap.contentRevision)
      this.touch(map.id, keys)
      return this.assemble(currentMap, center, halfExtent)
    }
    this.touch(map.id, keys)
    return this.assemble(map, center, halfExtent)
  }

  absorb(mapId: string, snapshot: HexChunkSnapshot): void {
    let mapCache = this.cache.get(mapId)
    if (mapCache === undefined) {
      mapCache = new Map()
      this.cache.set(mapId, mapCache)
    }
    const id = keyId(snapshot.key)
    const current = mapCache.get(id)
    if (current && current.revision > snapshot.revision) return
    mapCache.delete(id)
    mapCache.set(id, { revision: snapshot.revision, snapshot })
    this.staleChunks.get(mapId)?.delete(id)
    while (mapCache.size > maximumChunksPerMap) {
      const oldest = mapCache.keys().next().value
      if (oldest === undefined) break
      mapCache.delete(oldest)
    }
  }

  invalidateMap(mapId: string): void {
    this.loadedContentRevision.delete(mapId)
    this.staleChunks.delete(mapId)
    this.biomeDefinitions.delete(mapId)
  }

  invalidateChunks(mapId: string, keys: readonly HexChunkKey[]): void {
    let stale = this.staleChunks.get(mapId)
    if (!stale) {
      stale = new Set()
      this.staleChunks.set(mapId, stale)
    }
    for (const key of keys) stale.add(keyId(key))
  }

  clear(): void {
    this.cache.clear()
    this.loadedContentRevision.clear()
    this.staleChunks.clear()
    this.biomeDefinitions.clear()
  }

  private touch(mapId: string, keys: readonly HexChunkKey[]): void {
    const mapCache = this.cache.get(mapId)
    if (!mapCache) return
    for (const key of keys) {
      const id = keyId(key)
      const entry = mapCache.get(id)
      if (!entry) continue
      mapCache.delete(id)
      mapCache.set(id, entry)
    }
  }

  private absorbBiomes(
    mapId: string,
    definitions: readonly HexBiomeDefinition[]
  ): void {
    let current = this.biomeDefinitions.get(mapId)
    if (!current) {
      current = new Map()
      this.biomeDefinitions.set(mapId, current)
    }
    for (const definition of definitions) current.set(definition.id, definition)
  }

  private pruneBiomeDefinitions(mapId: string): void {
    const definitions = this.biomeDefinitions.get(mapId)
    if (!definitions) return
    const referenced = new Set<string>()
    for (const entry of this.cache.get(mapId)?.values() ?? [])
      for (const tile of entry.snapshot.authoredTiles)
        referenced.add(tile.biomeId)
    for (const id of definitions.keys())
      if (!referenced.has(id)) definitions.delete(id)
  }

  private assemble(
    map: HexMapSummary,
    center: AxialCoordinate,
    halfExtent = viewHalfExtent
  ): HexMapView {
    const chunks = this.cache.get(map.id)
    const authored = new Map<
      string,
      HexChunkSnapshot['authoredTiles'][number]
    >()
    const locations = new Map<string, HexChunkSnapshot['locations'][number]>()
    for (const entry of chunks?.values() ?? []) {
      for (const tile of entry.snapshot.authoredTiles)
        authored.set(coordinateId(tile), tile)
      for (const location of entry.snapshot.locations)
        locations.set(coordinateId(location), location)
    }
    const tiles = [...authored.values()]
      .filter(
        (tile) =>
          Math.abs(tile.q - center.q) <= halfExtent &&
          Math.abs(tile.r - center.r) <= halfExtent
      )
      .map((tile) => {
        const id = coordinateId(tile)
        return {
          ...tile,
          id,
          label: `Hex q=${tile.q}, r=${tile.r}`,
          location: locations.get(id) ?? null
        }
      })
    const usedBiomeIds = new Set(tiles.map((tile) => tile.biomeId))
    const biomes = [
      ...(this.biomeDefinitions.get(map.id)?.values() ?? [])
    ].filter((biome) => usedBiomeIds.has(biome.id))
    return { map, center, tiles, biomes }
  }
}

function keyId(key: HexChunkKey): string {
  return `${key.q}:${key.r}`
}

function coordinateId(coordinate: AxialCoordinate): string {
  return `${coordinate.q}:${coordinate.r}`
}
