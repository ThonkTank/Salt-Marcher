import { describe, expect, it } from 'vitest'
import {
  importLocationSymbolResultSchema,
  locationSymbolChangeNoticeSchema,
  locationSymbolDeleteResultSchema,
  locationSymbolPageSchema,
  locationSymbolSearchInputSchema
} from '../../src/shared/contracts/location-symbol.js'
import {
  hexChangeNoticeSchema,
  hexChunkSnapshotSchema,
  hexMarkerPresentationSchema
} from '../../src/shared/contracts/hex.js'
import {
  worldLocationChangeNoticeSchema,
  worldLocationMapPresentationPatchSchema
} from '../../src/shared/contracts/world-location.js'

const symbolId = '01900000-0000-7000-8000-000000000030'
const commandId = '01900000-0000-7000-8000-000000000031'
const customSymbol = {
  id: symbolId,
  displayName: 'Leuchtturm',
  viewBox: { minX: 0, minY: 0, width: 24, height: 24 },
  pathData: 'M2 22 L12 2 L22 22 Z',
  fillRule: 'nonzero' as const,
  position: 0
}

describe('location symbol contracts', () => {
  it('validates paged reads and enforces the bounded page size', () => {
    expect(locationSymbolSearchInputSchema.parse({})).toEqual({
      query: '',
      offset: 0,
      limit: 24
    })
    expect(
      locationSymbolPageSchema.parse({
        revision: 2,
        total: 1,
        offset: 0,
        symbols: [customSymbol]
      })
    ).toMatchObject({ revision: 2, total: 1 })
    expect(() => locationSymbolSearchInputSchema.parse({ limit: 25 })).toThrow()
  })

  it('keeps presentation patches partial and full marker projections complete', () => {
    expect(
      worldLocationMapPresentationPatchSchema.parse({ symbolSize: 60 })
    ).toEqual({ symbolSize: 60 })
    expect(() => worldLocationMapPresentationPatchSchema.parse({})).toThrow()
    expect(
      hexMarkerPresentationSchema.parse({
        revision: 4,
        title: 'Das Kap',
        symbol: {
          kind: 'custom',
          id: customSymbol.id,
          viewBox: customSymbol.viewBox,
          pathData: customSymbol.pathData,
          fillRule: customSymbol.fillRule
        },
        symbolSize: 60,
        labelCurve: 10,
        labelPosition: 'above'
      })
    ).toMatchObject({ revision: 4, title: 'Das Kap' })
  })

  it('requires complete chunk marker data and idempotent mutation envelopes', () => {
    expect(() =>
      hexChunkSnapshotSchema.parse({
        key: { q: 0, r: 0 },
        revision: 1,
        authoredTiles: [],
        locations: [
          {
            q: 0,
            r: 0,
            locationId: symbolId,
            displayName: 'Kap'
          }
        ]
      })
    ).toThrow()
    const snapshot = { revision: 3, symbols: [customSymbol] }
    expect(
      locationSymbolDeleteResultSchema.parse({
        status: 'replayed',
        commandId,
        symbols: snapshot
      })
    ).toMatchObject({ status: 'replayed', commandId })
    expect(
      importLocationSymbolResultSchema.parse({
        status: 'applied',
        commandId,
        symbols: snapshot,
        presentationRevision: 1
      })
    ).toMatchObject({ presentationRevision: 1 })
    expect(
      locationSymbolChangeNoticeSchema.parse({
        revision: 3,
        changedSymbolIds: [symbolId],
        reason: 'renamed'
      })
    ).toMatchObject({ reason: 'renamed' })
  })

  it('validates independent location, symbol and exact chunk notices', () => {
    const campaignId = '01900000-0000-7000-8000-000000000032'
    const mapId = '01900000-0000-7000-8000-000000000033'
    expect(
      worldLocationChangeNoticeSchema.parse({
        campaignId,
        revision: 4,
        changedLocationIds: [symbolId],
        reason: 'presentation'
      })
    ).toMatchObject({ reason: 'presentation', revision: 4 })
    expect(
      hexChangeNoticeSchema.parse({
        campaignId,
        commandId,
        mapIds: [mapId],
        changedChunks: [{ mapId, key: { q: -1, r: 2 }, revision: 7 }]
      })
    ).toMatchObject({
      mapIds: [mapId],
      changedChunks: [{ key: { q: -1, r: 2 }, revision: 7 }]
    })
  })
})
