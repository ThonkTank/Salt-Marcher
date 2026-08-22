// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type {
  HexBrushStrokeResult,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { createHexMapWriteCommands } from '../../src/renderer/features/hex/hex-map-write-commands.js'

const mapA = summary('01900000-0000-7000-8000-0000000000a1', 'A')
const mapB = summary('01900000-0000-7000-8000-0000000000b1', 'B')

describe('Hex map write commands', () => {
  it('keeps one map FIFO and reads its revision after prior acceptance', async () => {
    const first = deferred<HexBrushStrokeResult>()
    const fixture = commandFixture((input) =>
      input.displayName === 'Erster'
        ? first.promise
        : Promise.resolve(applied({ ...mapA, metadataRevision: 2 }))
    )

    fixture.context.editor.name = 'Erster'
    const earlier = fixture.commands.saveMetadata()
    fixture.context.editor.name = 'Zweiter'
    const later = fixture.commands.saveMetadata()
    await Promise.resolve()
    expect(fixture.updateMetadata).toHaveBeenCalledOnce()

    first.resolve(applied({ ...mapA, metadataRevision: 1 }))
    await earlier
    await later
    expect(fixture.updateMetadata).toHaveBeenCalledTimes(2)
    expect(fixture.updateMetadata.mock.calls[0]?.[0]).toMatchObject({
      mapId: mapA.id,
      displayName: 'Erster',
      expectedMetadataRevision: 0
    })
    expect(fixture.updateMetadata.mock.calls[1]?.[0]).toMatchObject({
      mapId: mapA.id,
      displayName: 'Zweiter',
      expectedMetadataRevision: 1
    })
  })

  it('lets independent map scopes finish without waiting for each other', async () => {
    const mapAGate = deferred<HexBrushStrokeResult>()
    const fixture = commandFixture((input) =>
      input.mapId === mapA.id
        ? mapAGate.promise
        : Promise.resolve(applied({ ...mapB, metadataRevision: 1 }))
    )

    const mapACommand = fixture.commands.saveMetadata()
    fixture.select(mapB)
    const mapBCommand = fixture.commands.saveMetadata()
    await mapBCommand
    expect(fixture.project).toHaveBeenCalledWith(
      expect.objectContaining({
        maps: [expect.objectContaining({ id: mapB.id })]
      })
    )
    expect(fixture.project).not.toHaveBeenCalledWith(
      expect.objectContaining({
        maps: [expect.objectContaining({ id: mapA.id })]
      })
    )

    mapAGate.resolve(applied({ ...mapA, metadataRevision: 1 }))
    await mapACommand
    expect(fixture.updateMetadata).toHaveBeenCalledTimes(2)
  })

  it('continues after a failed write and reports only that accepted failure', async () => {
    let invocation = 0
    const fixture = commandFixture(() => {
      invocation += 1
      return invocation === 1
        ? Promise.reject(new Error('first failed'))
        : Promise.resolve(applied({ ...mapA, metadataRevision: 1 }))
    })

    const failed = fixture.commands.saveMetadata()
    const recovered = fixture.commands.saveMetadata()
    await failed
    await recovered
    expect(fixture.context.onError).toHaveBeenCalledOnce()
    expect(fixture.project).toHaveBeenCalledOnce()
  })

  it('does not project or report a result canceled before acceptance', async () => {
    const transport = deferred<HexBrushStrokeResult>()
    const fixture = commandFixture(() => transport.promise)
    const command = fixture.commands.saveMetadata()
    await Promise.resolve()

    fixture.coordinator.cancelAll()
    transport.resolve(applied({ ...mapA, metadataRevision: 1 }))
    await command
    expect(fixture.project).not.toHaveBeenCalled()
    expect(fixture.context.onError).not.toHaveBeenCalled()
  })
})

function commandFixture(
  execute: (input: {
    mapId: string
    displayName: string
    expectedMetadataRevision: number
  }) => Promise<HexBrushStrokeResult>
) {
  const coordinator = new AsyncCommandCoordinator()
  const context = {
    editor: {
      name: 'Karte',
      catalog: { revision: 0, maps: [mapA, mapB] }
    },
    maps: { mapRef: { current: { map: mapA } } },
    onError: vi.fn()
  }
  const updateMetadata = vi.fn(execute)
  const project = vi.fn((result: HexBrushStrokeResult) => {
    if (result.status !== 'applied') return Promise.resolve()
    const changed = result.maps[0]
    if (!changed) return Promise.resolve()
    context.editor.catalog.maps = context.editor.catalog.maps.map((entry) =>
      entry.id === changed.id ? changed : entry
    )
    if (context.maps.mapRef.current.map.id === changed.id)
      context.maps.mapRef.current = { map: changed }
    return Promise.resolve()
  })
  const commands = createHexMapWriteCommands({
    campaignId: '01900000-0000-7000-8000-000000000001',
    coordinator,
    transport: { updateMetadata } as never,
    read: () => context as never,
    project
  })
  return {
    commands,
    context,
    coordinator,
    updateMetadata,
    project,
    select(map: HexMapSummary) {
      context.maps.mapRef.current = { map }
    }
  }
}

function summary(id: string, displayName: string): HexMapSummary {
  return {
    id,
    displayName,
    metadataRevision: 0,
    contentRevision: 0,
    position: 0
  }
}

function applied(map: HexMapSummary): HexBrushStrokeResult {
  return Object.freeze({
    status: 'applied',
    commandId: '01900000-0000-7000-8000-000000000099',
    catalogRevision: 1,
    maps: [Object.freeze(map)],
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
