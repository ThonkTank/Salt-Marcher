import { describe, expect, it, vi } from 'vitest'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { BiomeChangeNotice } from '../../src/shared/contracts/biome.js'
import type {
  HexChangeNotice,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'
import { createHexMapProjectionPort } from '../../src/renderer/features/hex/hex-map-projection-port.js'

const campaignId = '01900000-0000-7000-8000-000000000080'
const mapId = '01900000-0000-7000-8000-000000000081'
const commandId = '01900000-0000-7000-8000-000000000082'
const map: HexMapSummary = {
  id: mapId,
  displayName: 'Küste',
  metadataRevision: 0,
  contentRevision: 1,
  position: 0
}

function fixture() {
  let onHexChange: ((notice: HexChangeNotice) => void) | null = null
  let onBiomeChange: ((notice: BiomeChangeNotice) => void) | null = null
  const disconnectHex = vi.fn()
  const disconnectBiomes = vi.fn()
  const readChunks = vi.fn(
    ({ keys }: { mapId: string; keys: readonly { q: number; r: number }[] }) =>
      Promise.resolve({
        map,
        chunks: keys.map((key) => ({
          key,
          revision: 1,
          authoredTiles: [],
          locations: []
        })),
        biomes: []
      })
  )
  const api = {
    hex: {
      catalog: vi.fn().mockResolvedValue({ revision: 1, maps: [map] }),
      biomeCatalog: vi.fn().mockResolvedValue({ revision: 1, biomes: [] }),
      readChunks,
      locateLocation: vi.fn().mockResolvedValue(null),
      onChanged: vi.fn((listener: (notice: HexChangeNotice) => void) => {
        onHexChange = listener
        return disconnectHex
      })
    },
    biomes: {
      onChanged: vi.fn((listener: (notice: BiomeChangeNotice) => void) => {
        onBiomeChange = listener
        return disconnectBiomes
      })
    }
  } as unknown as Pick<SaltMarcherApi, 'hex' | 'biomes'>
  return {
    api,
    readChunks,
    disconnectHex,
    disconnectBiomes,
    emitHex: () =>
      onHexChange?.({
        campaignId,
        commandId,
        mapIds: [mapId],
        changedChunks: [{ mapId, key: { q: 0, r: 0 }, revision: 2 }]
      }),
    emitBiomes: () =>
      onBiomeChange?.({
        revision: 2,
        changedBiomeIds: ['grassland'],
        reason: 'updated'
      })
  }
}

describe('Hex map projection port', () => {
  it('owns catalog, chunk cache, exact invalidation and biome invalidation', async () => {
    const test = fixture()
    const port = createHexMapProjectionPort(test.api)
    const changes: string[] = []
    const unsubscribe = port.subscribe((change) => changes.push(change.kind))

    expect(port.cacheLifetime).toBe('transient')
    expect(port.currentCatalog()).toBeNull()
    await port.readMap({ mapId })
    expect(port.currentCatalog()?.maps).toHaveLength(1)
    test.readChunks.mockClear()
    await port.readMap({ mapId })
    expect(test.readChunks).not.toHaveBeenCalled()

    test.emitHex()
    await port.readMap({ mapId })
    expect(changes).toEqual(['hex'])
    expect(test.readChunks).toHaveBeenCalledOnce()
    expect(test.readChunks.mock.calls[0]?.[0]).toMatchObject({
      mapId,
      keys: [{ q: 0, r: 0 }]
    })

    test.readChunks.mockClear()
    test.emitBiomes()
    await port.readBiomeCatalog()
    await port.readMap({ mapId })
    expect(changes).toEqual(['hex', 'biomes'])
    expect(test.readChunks).toHaveBeenCalled()

    unsubscribe()
    expect(test.disconnectHex).toHaveBeenCalledOnce()
    expect(test.disconnectBiomes).toHaveBeenCalledOnce()
    port.dispose()
    expect(() => port.subscribe(() => undefined)).toThrow('disposed')
  })
})
