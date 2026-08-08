import { describe, expect, it, vi } from 'vitest'
import type {
  HexChunkKey,
  HexChunkSnapshot,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'
import { HexChunkCache } from '../../src/renderer/features/hex/hex-chunk-cache.js'

const map: HexMapSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Cache',
  metadataRevision: 0,
  contentRevision: 1,
  position: 0
}

function chunk(key: HexChunkKey, revision = 1): HexChunkSnapshot {
  return {
    key,
    revision,
    authoredTiles: [{ q: key.q * 32, r: key.r * 32, biomeId: 'grassland' }],
    locations: []
  }
}

describe('HexChunkCache', () => {
  it('bounds each map to 256 least-recently-used chunks', async () => {
    const read = vi.fn((_mapId: string, keys: readonly HexChunkKey[]) =>
      Promise.resolve({
        map,
        chunks: keys.map((key) => chunk(key)),
        biomes: []
      })
    )
    const cache = new HexChunkCache(read)
    for (let q = 0; q <= 256; q += 1)
      await cache.readMapView(map, { q: q * 32, r: 0 }, false, 0)
    expect(read).toHaveBeenCalledTimes(257)
    await cache.readMapView(map, { q: 0, r: 0 }, false, 0)
    expect(read).toHaveBeenCalledTimes(258)
  })

  it('does not replace a chunk with an out-of-order older response', async () => {
    let revision = 2
    const read = vi.fn((_mapId: string, keys: readonly HexChunkKey[]) =>
      Promise.resolve({
        map,
        biomes: [
          {
            id: revision === 2 ? ('forest' as const) : ('water' as const),
            label: revision === 2 ? 'Wald' : 'Wasser',
            color: revision === 2 ? '#3f704d' : '#397aa1',
            passable: revision === 2,
            travelCost: revision === 2 ? 4 : 1
          }
        ],
        chunks: keys.map((key) => ({
          ...chunk(key, revision),
          authoredTiles: [
            {
              q: key.q * 32,
              r: key.r * 32,
              biomeId: revision === 2 ? ('forest' as const) : ('water' as const)
            }
          ]
        }))
      })
    )
    const cache = new HexChunkCache(read)
    const first = await cache.readMapView(map, { q: 0, r: 0 }, false, 0)
    expect(first.tiles[0]?.biomeId).toBe('forest')
    expect(first.biomes).toEqual([
      expect.objectContaining({ id: 'forest', label: 'Wald' })
    ])
    revision = 1
    cache.invalidateChunks(map.id, [{ q: 0, r: 0 }])
    const second = await cache.readMapView(map, { q: 0, r: 0 }, false, 0)
    expect(second.tiles[0]?.biomeId).toBe('forest')
    expect(second.biomes).toEqual([
      expect.objectContaining({ id: 'forest', label: 'Wald' })
    ])
  })
})
