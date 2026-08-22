import { describe, expect, it, vi } from 'vitest'
import type {
  HexBrushStrokeResult,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'
import { projectHexCommandResult } from '../../src/renderer/features/hex/hex-command-projection.js'

describe('Hex command projection', () => {
  it('publishes an immutable off-screen map result without replacing current view state', async () => {
    const mapA = summary('01900000-0000-7000-8000-0000000000a1', 0)
    const mapB = summary('01900000-0000-7000-8000-0000000000b1', 0)
    const changedA = Object.freeze({ ...mapA, contentRevision: 1 })
    const result = applied(changedA)
    let catalog = { revision: 0, maps: [mapA, mapB] }
    const setHistory = vi.fn()
    const setMap = vi.fn()
    const readMapView = vi.fn()
    const context = {
      editor: {
        setCatalog: (update: (current: typeof catalog) => typeof catalog) => {
          catalog = update(catalog)
        },
        setMap,
        setPendingErase: vi.fn(),
        setHistory
      },
      maps: {
        mapRef: { current: { map: mapB, center: { q: 0, r: 0 } } },
        chunkCache: {
          current: { invalidateChunks: vi.fn(), readMapView }
        },
        viewportRequest: { current: 0 },
        viewportHalfExtent: { current: 64 }
      },
      onError: vi.fn()
    }

    await expect(
      projectHexCommandResult(context as never, result)
    ).resolves.toBe(result)
    expect(catalog).toEqual({ revision: 1, maps: [changedA, mapB] })
    expect(readMapView).not.toHaveBeenCalled()
    expect(setMap).not.toHaveBeenCalled()
    expect(setHistory).not.toHaveBeenCalled()
    if (result.status !== 'applied') throw new Error('Expected applied result')
    expect(result.maps[0]).toBe(changedA)
  })

  it('does not replace a map selected while accepted projection is reading', async () => {
    const mapA = summary('01900000-0000-7000-8000-0000000000a1', 0)
    const mapB = summary('01900000-0000-7000-8000-0000000000b1', 0)
    const changedA = Object.freeze({ ...mapA, contentRevision: 1 })
    const nextView = deferred<never>()
    const setMap = vi.fn()
    const mapRef = {
      current: { map: mapA, center: { q: 0, r: 0 } }
    }
    const context = {
      editor: {
        setCatalog: vi.fn(),
        setMap,
        setPendingErase: vi.fn(),
        setHistory: vi.fn()
      },
      maps: {
        mapRef,
        chunkCache: {
          current: {
            invalidateChunks: vi.fn(),
            readMapView: vi.fn(() => nextView.promise)
          }
        },
        viewportRequest: { current: 0 },
        viewportHalfExtent: { current: 64 }
      },
      onError: vi.fn()
    }
    const projection = projectHexCommandResult(
      context as never,
      applied(changedA)
    )
    await Promise.resolve()
    mapRef.current = { map: mapB, center: { q: 0, r: 0 } }
    nextView.resolve({ map: changedA, center: { q: 0, r: 0 } } as never)

    await projection
    expect(setMap).not.toHaveBeenCalled()
  })
})

function summary(id: string, contentRevision: number): HexMapSummary {
  return {
    id,
    displayName: id,
    metadataRevision: 0,
    contentRevision,
    position: 0
  }
}

function applied(map: HexMapSummary): HexBrushStrokeResult {
  return Object.freeze({
    status: 'applied',
    commandId: '01900000-0000-7000-8000-000000000099',
    catalogRevision: 1,
    maps: [map],
    changedChunks: [],
    history: Object.freeze({
      canUndo: true,
      canRedo: false,
      undoLabel: 'Änderung',
      redoLabel: null
    }),
    changed: true,
    affectedTileCount: 1,
    impact: { locations: [], journeys: [], partyMembers: [] },
    warnings: []
  })
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<Value>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
