// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useHexLocationPlacementDraft } from '../../src/renderer/features/hex/use-hex-location-placement-draft.js'
import type {
  HexMapProjectionChange,
  HexMapProjectionPort
} from '../../src/renderer/features/hex/hex-map-projection-port.js'
import { HexChunkCache } from '../../src/renderer/features/hex/hex-chunk-cache.js'
import type {
  HexChangeNotice,
  HexChunkKey,
  HexChunkReadResult,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'
import type { BiomeChangeNotice } from '../../src/shared/contracts/biome.js'

const campaignId = '01900000-0000-7000-8000-000000000080'
const mapAId = '01900000-0000-7000-8000-000000000081'
const mapBId = '01900000-0000-7000-8000-000000000082'
const commandId = '01900000-0000-7000-8000-000000000083'
const summary = (id: string, position: number): HexMapSummary => ({
  id,
  displayName: id === mapAId ? 'Küste' : 'Inseln',
  metadataRevision: 0,
  contentRevision: 1,
  position
})
const maps = [summary(mapAId, 0), summary(mapBId, 1)]
const chunks = (
  map: HexMapSummary,
  keys: readonly HexChunkKey[]
): HexChunkReadResult => ({
  map,
  chunks: keys.map((key) => ({
    key,
    revision: 1,
    authoredTiles: [],
    locations: []
  })),
  biomes: []
})
const notice: HexChangeNotice = {
  campaignId,
  commandId,
  mapIds: [mapAId],
  changedChunks: [{ mapId: mapAId, key: { q: 0, r: 0 }, revision: 2 }]
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function projectionFixture(
  readChunks: (
    mapId: string,
    keys: readonly HexChunkKey[]
  ) => Promise<HexChunkReadResult>
) {
  let listener: ((change: HexMapProjectionChange) => void) | null = null
  const cache = new HexChunkCache(readChunks)
  const port: HexMapProjectionPort = {
    cacheLifetime: 'transient',
    currentCatalog: () => null,
    currentBiomeCatalog: () => null,
    readCatalog: vi.fn().mockResolvedValue({ revision: 1, maps }),
    readBiomeCatalog: vi.fn().mockResolvedValue({ revision: 0, biomes: [] }),
    locateLocation: vi.fn().mockResolvedValue(null),
    readMap: vi.fn((input: Parameters<HexMapProjectionPort['readMap']>[0]) =>
      cache.readMapView(
        maps.find((map) => map.id === input.mapId)!,
        input.center,
        input.force,
        input.halfExtent
      )
    ),
    subscribe: vi
      .fn()
      .mockImplementation((next: (change: HexMapProjectionChange) => void) => {
        listener = next
        return () => {
          listener = null
        }
      }),
    dispose: vi.fn()
  }
  return {
    port,
    cache,
    emitHex: (next: HexChangeNotice) => {
      if (port.cacheLifetime === 'transient')
        for (const mapId of next.mapIds)
          cache.invalidateChunks(
            mapId,
            next.changedChunks
              .filter((chunk) => chunk.mapId === mapId)
              .map((chunk) => chunk.key)
          )
      listener?.({ kind: 'hex', notice: next })
    },
    emitBiomes: (next: BiomeChangeNotice) =>
      listener?.({ kind: 'biomes', notice: next })
  }
}

describe('useHexLocationPlacementDraft', () => {
  it('invalidates and reloads only the changed chunk', async () => {
    const readChunks = vi.fn((mapId: string, keys: readonly HexChunkKey[]) =>
      Promise.resolve(
        chunks(
          maps.find((map) => map.id === mapId)!,
          keys
        )
      )
    )
    const fixture = projectionFixture(readChunks)
    const onReady = vi.fn()
    const onChange = vi.fn()
    const hook = renderHook(() =>
      useHexLocationPlacementDraft({
        port: fixture.port,
        locationId: null,
        initialHint: null,
        onReady,
        onViewMap: vi.fn(),
        onChange
      })
    )
    await waitFor(() => expect(hook.result.current.map?.map.id).toBe(mapAId))
    readChunks.mockClear()

    act(() => fixture.emitHex(notice))
    await waitFor(() => expect(readChunks).toHaveBeenCalledOnce())
    expect(readChunks).toHaveBeenCalledWith(mapAId, [{ q: 0, r: 0 }])
  })

  it('does not let a late refresh replace a newer map navigation', async () => {
    const refresh = deferred<HexChunkReadResult>()
    const navigation = deferred<HexChunkReadResult>()
    let deferRefresh = false
    const readChunks = vi.fn((mapId: string, keys: readonly HexChunkKey[]) => {
      if (mapId === mapBId) return navigation.promise
      if (deferRefresh) return refresh.promise
      return Promise.resolve(chunks(maps[0]!, keys))
    })
    const fixture = projectionFixture(readChunks)
    const onReady = vi.fn()
    const onChange = vi.fn()
    const hook = renderHook(() =>
      useHexLocationPlacementDraft({
        port: fixture.port,
        locationId: null,
        initialHint: null,
        onReady,
        onViewMap: vi.fn(),
        onChange
      })
    )
    await waitFor(() => expect(hook.result.current.map?.map.id).toBe(mapAId))

    deferRefresh = true
    act(() => fixture.emitHex(notice))
    let navigationPromise!: Promise<void>
    act(() => {
      navigationPromise = hook.result.current.changeMap(mapBId)
    })
    await act(async () => {
      navigation.resolve(chunks(maps[1]!, [{ q: 0, r: 0 }]))
      await navigationPromise
    })
    expect(hook.result.current.map?.map.id).toBe(mapBId)

    await act(async () => {
      refresh.resolve(chunks(maps[0]!, [{ q: 0, r: 0 }]))
      await Promise.resolve()
    })
    expect(hook.result.current.map?.map.id).toBe(mapBId)
  })

  it('ignores an older viewport response after a newer viewport wins', async () => {
    const older = deferred<HexChunkReadResult>()
    const newer = deferred<HexChunkReadResult>()
    let viewportRead = 0
    const readChunks = vi.fn((_mapId: string, keys: readonly HexChunkKey[]) => {
      if (keys.some((key) => key.q >= 4)) {
        viewportRead += 1
        return viewportRead === 1 ? older.promise : newer.promise
      }
      return Promise.resolve(chunks(maps[0]!, keys))
    })
    const fixture = projectionFixture(readChunks)
    const hook = renderHook(() =>
      useHexLocationPlacementDraft({
        port: fixture.port,
        locationId: null,
        initialHint: null,
        onReady: vi.fn(),
        onViewMap: vi.fn(),
        onChange: vi.fn()
      })
    )
    await waitFor(() => expect(hook.result.current.map).not.toBeNull())

    act(() => hook.result.current.loadViewport({ q: 200, r: 0 }, 1))
    act(() => hook.result.current.loadViewport({ q: 240, r: 0 }, 1))
    act(() => newer.resolve(chunks(maps[0]!, [{ q: 7, r: 0 }])))
    await waitFor(() =>
      expect(hook.result.current.map?.center).toEqual({ q: 240, r: 0 })
    )
    act(() => older.resolve(chunks(maps[0]!, [{ q: 6, r: 0 }])))
    await waitFor(() =>
      expect(hook.result.current.map?.center).toEqual({ q: 240, r: 0 })
    )
  })

  it('keeps the last stable map visible when a refresh fails', async () => {
    const readChunks = vi.fn((_mapId: string, keys: readonly HexChunkKey[]) =>
      Promise.resolve(chunks(maps[0]!, keys))
    )
    const fixture = projectionFixture(readChunks)
    const hook = renderHook(() =>
      useHexLocationPlacementDraft({
        port: fixture.port,
        locationId: null,
        initialHint: null,
        onReady: vi.fn(),
        onViewMap: vi.fn(),
        onChange: vi.fn()
      })
    )
    await waitFor(() => expect(hook.result.current.state.status).toBe('ready'))
    vi.mocked(fixture.port.readCatalog).mockRejectedValueOnce(
      new Error('offline')
    )
    act(() => fixture.emitHex(notice))
    await waitFor(() =>
      expect(hook.result.current.state.status).toBe('degraded')
    )
    expect(hook.result.current.map?.map.id).toBe(mapAId)
  })

  it('retains a missing existing map as a conflict instead of staging remove', async () => {
    const readChunks = vi.fn((_mapId: string, keys: readonly HexChunkKey[]) =>
      Promise.resolve(chunks(maps[0]!, keys))
    )
    const fixture = projectionFixture(readChunks)
    const missingMapId = '01900000-0000-7000-8000-000000000099'
    vi.mocked(fixture.port.locateLocation).mockResolvedValue({
      mapId: missingMapId,
      coordinate: { q: 3, r: 4 },
      contentRevision: 9
    })
    const onReady = vi.fn()
    const hook = renderHook(() =>
      useHexLocationPlacementDraft({
        port: fixture.port,
        locationId: '01900000-0000-7000-8000-000000000070',
        initialHint: null,
        onReady,
        onViewMap: vi.fn(),
        onChange: vi.fn()
      })
    )
    await waitFor(() =>
      expect(hook.result.current.state.status).toBe('degraded')
    )
    const selection = {
      mapId: missingMapId,
      coordinate: { q: 3, r: 4 }
    }
    expect(onReady).toHaveBeenCalledWith({
      viewedMapId: null,
      placementDraft: { baseline: selection, current: selection }
    })
    expect(hook.result.current.error).toMatchObject({
      source: 'placement',
      kind: 'map-missing'
    })
  })

  it('refreshes biome data symmetrically and delegates invalidation to a shared owner', async () => {
    const readChunks = vi.fn((_mapId: string, keys: readonly HexChunkKey[]) =>
      Promise.resolve(chunks(maps[0]!, keys))
    )
    const fixture = projectionFixture(readChunks)
    Object.assign(fixture.port, { cacheLifetime: 'shared-owner' as const })
    const invalidateChunks = vi.spyOn(fixture.cache, 'invalidateChunks')
    const hook = renderHook(() =>
      useHexLocationPlacementDraft({
        port: fixture.port,
        locationId: null,
        initialHint: null,
        onReady: vi.fn(),
        onViewMap: vi.fn(),
        onChange: vi.fn()
      })
    )
    await waitFor(() => expect(hook.result.current.state.status).toBe('ready'))
    vi.mocked(fixture.port.readBiomeCatalog).mockClear()
    act(() =>
      fixture.emitBiomes({
        revision: 2,
        changedBiomeIds: ['grassland'],
        reason: 'updated'
      })
    )
    await waitFor(() =>
      expect(fixture.port.readBiomeCatalog).toHaveBeenCalledOnce()
    )
    act(() => fixture.emitHex(notice))
    await waitFor(() =>
      expect(fixture.port.readCatalog).toHaveBeenCalledTimes(2)
    )
    expect(invalidateChunks).not.toHaveBeenCalled()
    expect(fixture.port.subscribe).toHaveBeenCalledOnce()
  })
})
