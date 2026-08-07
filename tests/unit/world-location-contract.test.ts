import { describe, expect, it } from 'vitest'
import {
  worldLocationDraftSchema,
  worldLocationSchema,
  worldLocationTagSearchInputSchema
} from '../../src/shared/contracts/world-location.js'

describe('world location contract', () => {
  it('defaults optional references and read-aloud text', () => {
    expect(
      worldLocationDraftSchema.parse({
        displayName: '  Salzhafen  ',
        tags: ['  Hafen  '],
        notes: ''
      })
    ).toEqual({
      displayName: 'Salzhafen',
      tags: ['Hafen'],
      readAloud: '',
      notes: '',
      factionIds: [],
      encounterTableIds: []
    })
  })

  it('bounds tags and rejects retired kind and region fields', () => {
    expect(() =>
      worldLocationDraftSchema.parse({
        displayName: 'Ohne Tag',
        tags: [],
        notes: ''
      })
    ).toThrow()
    expect(() =>
      worldLocationDraftSchema.parse({
        displayName: 'Leerer Tag',
        tags: ['   '],
        notes: ''
      })
    ).toThrow()
    expect(() =>
      worldLocationDraftSchema.parse({
        displayName: 'Doppelt',
        tags: ['Hafen', ' hAFEN '],
        notes: ''
      })
    ).toThrow()
    expect(() =>
      worldLocationDraftSchema.parse({
        displayName: 'Zu viele Tags',
        notes: '',
        tags: Array.from({ length: 21 }, (_, index) => `Tag ${index}`)
      })
    ).toThrow()
    expect(() =>
      worldLocationDraftSchema.parse({
        displayName: 'Zu langer Tag',
        notes: '',
        tags: ['x'.repeat(41)]
      })
    ).toThrow()
    expect(() =>
      worldLocationSchema.parse({
        id: '01900000-0000-7000-8000-000000000001',
        displayName: 'Altlast',
        kind: 'Ruine',
        region: 'Küste',
        tags: ['Ruine'],
        readAloud: '',
        notes: '',
        position: 0,
        factionIds: [],
        encounterTableIds: [],
        mapPresentation: {
          revision: 0,
          titleOverride: null,
          symbolId: 'location',
          symbolSize: 44,
          labelCurve: 0,
          labelPosition: 'below'
        }
      })
    ).toThrow()
    expect(() =>
      worldLocationDraftSchema.parse({
        displayName: 'Alter Draft',
        tags: ['Ruine'],
        notes: '',
        kind: 'Ruine',
        region: 'Küste'
      })
    ).toThrow()
  })

  it('normalizes compatibility characters before duplicate detection', () => {
    expect(() =>
      worldLocationDraftSchema.parse({
        displayName: 'Kompatibel',
        tags: ['ℌafen', 'Hafen'],
        notes: ''
      })
    ).toThrow()
  })

  it('bounds tag suggestion queries at the capability boundary', () => {
    expect(
      worldLocationTagSearchInputSchema.parse({ query: '  Küste  ' })
    ).toEqual({ query: 'Küste', limit: 6 })
    expect(() =>
      worldLocationTagSearchInputSchema.parse({ query: '', limit: 11 })
    ).toThrow()
  })
})
