import {
  type AxialCoordinate,
  type HexChunkKey,
  type HexChunkSnapshot,
  type HexMapSummary,
  type HexMapView
} from '../../../shared/contracts/hex.js'

const chunkSize = 32
const viewHalfExtent = 12

const cache = new Map<
  string,
  Map<string, { revision: number; snapshot: HexChunkSnapshot }>
>()
const loadedContentRevision = new Map<string, number>()

export function chunkKeyForCoordinate(
  coordinate: AxialCoordinate
): HexChunkKey {
  return {
    q: Math.floor(coordinate.q / chunkSize),
    r: Math.floor(coordinate.r / chunkSize)
  }
}

export function visibleChunkKeys(center: AxialCoordinate): HexChunkKey[] {
  const origin = chunkKeyForCoordinate(center)
  const keys: HexChunkKey[] = []
  for (let q = origin.q - 1; q <= origin.q + 1; q += 1)
    for (let r = origin.r - 1; r <= origin.r + 1; r += 1) keys.push({ q, r })
  return keys
}

export async function readHexMapView(
  map: HexMapSummary,
  center: AxialCoordinate = { q: 0, r: 0 },
  force = false
): Promise<HexMapView> {
  const keys = visibleChunkKeys(center)
  const mapCache = cache.get(map.id)
  const warm =
    !force &&
    loadedContentRevision.get(map.id) === map.contentRevision &&
    keys.every((key) => mapCache?.has(keyId(key)))
  if (!warm) {
    const result = await window.saltMarcher.hex.readChunks(map.id, keys)
    for (const chunk of result.chunks) absorbChunk(map.id, chunk)
    loadedContentRevision.set(map.id, result.map.contentRevision)
    return assemble(result.map, center)
  }
  return assemble(map, center)
}

export function chunkRevision(
  mapId: string,
  coordinate: AxialCoordinate
): number {
  return (
    cache.get(mapId)?.get(keyId(chunkKeyForCoordinate(coordinate)))?.revision ??
    0
  )
}

export function absorbChunk(mapId: string, snapshot: HexChunkSnapshot): void {
  let mapCache = cache.get(mapId)
  if (mapCache === undefined) {
    mapCache = new Map()
    cache.set(mapId, mapCache)
  }
  mapCache.set(keyId(snapshot.key), {
    revision: snapshot.revision,
    snapshot
  })
}

export function invalidateHexMap(mapId: string): void {
  loadedContentRevision.delete(mapId)
}

function assemble(map: HexMapSummary, center: AxialCoordinate): HexMapView {
  const chunks = cache.get(map.id)
  const terrain = new Map<string, string>()
  const locations = new Map<string, HexChunkSnapshot['locations'][number]>()
  for (const entry of chunks?.values() ?? []) {
    for (const override of entry.snapshot.terrainOverrides)
      terrain.set(coordinateId(override), override.terrainId)
    for (const location of entry.snapshot.locations)
      locations.set(coordinateId(location), location)
  }
  const tiles = []
  for (
    let q = center.q - viewHalfExtent;
    q <= center.q + viewHalfExtent;
    q += 1
  )
    for (
      let r = center.r - viewHalfExtent;
      r <= center.r + viewHalfExtent;
      r += 1
    ) {
      const coordinate = { q, r }
      const id = coordinateId(coordinate)
      tiles.push({
        ...coordinate,
        id,
        label: `Hex q=${q}, r=${r}`,
        terrainId: terrain.get(id) ?? 'grassland',
        location: locations.get(id) ?? null
      })
    }
  return { map, center, tiles } as HexMapView
}

function keyId(key: HexChunkKey): string {
  return `${key.q}:${key.r}`
}

function coordinateId(coordinate: AxialCoordinate): string {
  return `${coordinate.q}:${coordinate.r}`
}
