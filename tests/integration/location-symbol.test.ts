import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import {
  LocationSymbolService,
  LocationSymbolStore
} from '../../src/core/worldplanner/location-symbol-store.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { LocationSymbolLifecycleService } from '../../src/core/application/location-symbol-lifecycle.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('installation location symbols', () => {
  it('stores one SVG path installation-wide and references it from a location', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    campaigns.create('First')
    const symbols = new LocationSymbolService(() =>
      campaigns.installationDatabase()
    )
    const created = symbols.create(
      {
        displayName: 'Leuchtturm',
        viewBox: { minX: 0, minY: 0, width: 16, height: 16 },
        pathData: 'M 1 15 L 8 1 L 15 15 Z'
      },
      0
    )
    const symbolId = created.saved.id
    const locations = new WorldLocationService(
      () => campaigns.activeCampaignDatabase(),
      (id) => symbols.read().symbols.find((symbol) => symbol.id === id) ?? null
    )
    const world = locations.create(
      { displayName: 'Kap', tags: ['Kap'], notes: '' },
      locations.read().revision
    ).snapshot
    const presentation = locations.updateMapPresentation(
      world.locations[0]!.id,
      {
        titleOverride: 'Das schwarze Kap',
        symbolId,
        symbolSize: 56,
        labelCurve: 12,
        labelPosition: 'above'
      },
      world.locations[0]!.mapPresentation.revision
    )
    expect(presentation).toEqual({
      revision: 1,
      titleOverride: 'Das schwarze Kap',
      symbolId,
      symbolSize: 56,
      labelCurve: 12,
      labelPosition: 'above'
    })

    campaigns.create('Second')
    expect(symbols.read()).toEqual(created.snapshot)
    campaigns.close()
  })

  it('rejects stale revisions, duplicate names and invalid custom references', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    campaigns.create('Validation')
    const symbols = new LocationSymbolService(() =>
      campaigns.installationDatabase()
    )
    const draft = {
      displayName: 'Anker',
      viewBox: { minX: 0, minY: 0, width: 10, height: 10 },
      pathData: 'M0 0 L10 10 Z'
    }
    symbols.create(draft, 0)
    expect(() => symbols.create({ ...draft, displayName: 'Ort' }, 1)).toThrow(
      'validation_failed'
    )
    expect(() => symbols.create({ ...draft, displayName: 'anker' }, 1)).toThrow(
      'validation_failed'
    )
    expect(() => symbols.create({ ...draft, displayName: 'Mast' }, 0)).toThrow(
      'stale'
    )

    const locations = new WorldLocationService(() =>
      campaigns.activeCampaignDatabase()
    )
    const world = locations.create(
      { displayName: 'Kap', tags: ['Kap'], notes: '' },
      0
    ).snapshot
    expect(() =>
      locations.updateMapPresentation(
        world.locations[0]!.id,
        { symbolId: '01900000-0000-7000-8000-000000000099' },
        0
      )
    ).toThrow('not_found')
    campaigns.close()
  })

  it('pages, reads and renames the installation catalog', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    campaigns.create('Catalog')
    const symbols = new LocationSymbolService(() =>
      campaigns.installationDatabase()
    )
    let revision = 0
    for (let index = 0; index < 26; index += 1)
      revision = symbols.create(
        {
          displayName: `Zeichen ${index.toString().padStart(2, '0')}`,
          viewBox: { minX: 0, minY: 0, width: 10, height: 10 },
          pathData: 'M0 0 L10 10 Z'
        },
        revision
      ).snapshot.revision
    const first = symbols.search('Zeichen', 0, 24)
    const second = symbols.search('Zeichen', 24, 24)
    expect(first).toMatchObject({ revision: 26, total: 26, offset: 0 })
    expect(first.symbols).toHaveLength(24)
    expect(second.symbols).toHaveLength(2)
    const selected = second.symbols[0]!
    expect(symbols.detail(selected.id)).toEqual(selected)
    const renamed = symbols.update(selected.id, 'Bake', second.revision)
    expect(renamed).toMatchObject({ revision: 27 })
    expect(symbols.detail(selected.id).displayName).toBe('Bake')
    campaigns.close()
  })

  it('reports and replaces usages across active and trashed campaigns', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const firstId = campaigns.create('First').activeCampaignId!
    const lifecycle = new LocationSymbolLifecycleService(campaigns)
    const created = lifecycle.symbols.create(
      {
        displayName: 'Windrose',
        viewBox: { minX: 0, minY: 0, width: 10, height: 10 },
        pathData: 'M0 5 L10 5 M5 0 L5 10'
      },
      0
    )
    const symbolId = created.saved.id
    const createUsage = (name: string) => {
      const locations = new WorldLocationService(
        () => campaigns.activeCampaignDatabase(),
        (id) => lifecycle.customSymbol(id)
      )
      const location = locations.create(
        { displayName: name, tags: ['Ort'], notes: '' },
        0
      ).snapshot.locations[0]!
      locations.updateMapPresentation(
        location.id,
        { symbolId },
        location.mapPresentation.revision
      )
      return location.id
    }
    const firstLocationId = createUsage('Nordkap')
    const secondId = campaigns.create('Second').activeCampaignId!
    const secondLocationId = createUsage('Südkap')
    campaigns.trash(secondId)
    campaigns.activate(firstId)

    expect(lifecycle.deleteImpact(symbolId)).toMatchObject({
      totalLocations: 2,
      usages: [
        { campaignId: firstId, trashed: false },
        { campaignId: secondId, trashed: true }
      ]
    })
    const commandId = crypto.randomUUID()
    const applied = lifecycle.delete({
      commandId,
      id: symbolId,
      expectedRevision: created.snapshot.revision
    })
    expect(applied.status).toBe('applied')
    expect(
      lifecycle.delete({
        commandId,
        id: symbolId,
        expectedRevision: created.snapshot.revision
      }).status
    ).toBe('replayed')
    expect(
      lifecycle
        .locationStore(campaigns.activeCampaignDatabase())
        .mapPresentation(firstLocationId).symbolId
    ).toBe('location')
    campaigns.restore(secondId)
    campaigns.activate(secondId)
    expect(
      lifecycle
        .locationStore(campaigns.activeCampaignDatabase())
        .mapPresentation(secondLocationId).symbolId
    ).toBe('location')
    campaigns.close()
  })

  it('replays one import-and-assign command without duplicating its symbol', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    campaigns.create('Import')
    const lifecycle = new LocationSymbolLifecycleService(campaigns)
    const location = new WorldLocationService(() =>
      campaigns.activeCampaignDatabase()
    ).create({ displayName: 'Klippe', tags: ['Klippe'], notes: '' }, 0).snapshot
      .locations[0]!
    const input = {
      commandId: crypto.randomUUID(),
      displayName: 'Bake',
      source:
        '<svg viewBox="0 0 10 10"><path fill-rule="evenodd" d="M0 10 L5 0 L10 10 Z"/></svg>',
      locationId: location.id,
      expectedSymbolRevision: 0,
      expectedPresentationRevision: 0
    }

    const applied = lifecycle.importAndAssign(input)
    const replayed = lifecycle.importAndAssign(input)
    expect(applied.status).toBe('applied')
    expect(replayed.status).toBe('replayed')
    expect(replayed.createdSymbolId).toBe(applied.createdSymbolId)
    expect(replayed.symbols.symbols).toHaveLength(1)
    expect(() =>
      lifecycle.importAndAssign({
        ...input,
        source:
          '<svg viewBox="0 0 20 20"><path d="M0 20 L10 0 L20 20 Z"/></svg>'
      })
    ).toThrow('validation_failed')
    expect(
      lifecycle
        .locationStore(campaigns.activeCampaignDatabase())
        .mapPresentation(location.id)
    ).toMatchObject({ symbolId: applied.createdSymbolId, revision: 1 })
    campaigns.close()
  })

  it('compensates an interrupted import during startup recovery', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const campaignId = campaigns.create('Recovery').activeCampaignId!
    const location = new WorldLocationService(() =>
      campaigns.activeCampaignDatabase()
    ).create({ displayName: 'Klippe', tags: ['Klippe'], notes: '' }, 0).snapshot
      .locations[0]!
    const commandId = crypto.randomUUID()
    const pending = new LocationSymbolStore(
      campaigns.installationDatabase()
    ).beginImport({
      commandId,
      campaignId,
      locationId: location.id,
      expectedPresentationRevision: 0,
      expectedSymbolRevision: 0,
      symbol: {
        displayName: 'Abgebrochener Import',
        viewBox: { minX: 0, minY: 0, width: 10, height: 10 },
        pathData: 'M0 0 L10 10'
      }
    })
    expect(pending.symbols.symbols).toHaveLength(1)
    campaigns.close()

    const reopened = new CampaignStore(root)
    const recovered = new LocationSymbolLifecycleService(reopened)
    recovered.recoverPendingImports()
    expect(recovered.symbols.read().symbols).toEqual([])
    expect(
      recovered
        .locationStore(reopened.activeCampaignDatabase())
        .mapPresentation(location.id).symbolId
    ).toBe('location')
    reopened.close()
  })

  it('finishes recovery when an interrupted import was already assigned', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const campaignId = campaigns.create('Assigned recovery').activeCampaignId!
    const location = new WorldLocationService(() =>
      campaigns.activeCampaignDatabase()
    ).create({ displayName: 'Bake', tags: ['Bake'], notes: '' }, 0).snapshot
      .locations[0]!
    const commandId = crypto.randomUUID()
    const source =
      '<svg viewBox="0 0 10 10"><path d="M0 10 L5 0 L10 10 Z"/></svg>'
    const store = new LocationSymbolStore(campaigns.installationDatabase())
    const pending = store.beginImport({
      commandId,
      campaignId,
      locationId: location.id,
      expectedPresentationRevision: 0,
      expectedSymbolRevision: 0,
      symbol: {
        displayName: 'Küstenzeichen',
        viewBox: { minX: 0, minY: 0, width: 10, height: 10 },
        pathData: 'M0 10 L5 0 L10 10 Z'
      }
    })
    const lifecycle = new LocationSymbolLifecycleService(campaigns)
    lifecycle
      .locationStore(campaigns.activeCampaignDatabase())
      .updateMapPresentation(
        location.id,
        { symbolId: pending.createdSymbolId },
        0
      )
    campaigns.close()

    const reopened = new CampaignStore(root)
    const recovered = new LocationSymbolLifecycleService(reopened)
    recovered.recoverPendingImports()
    expect(recovered.symbols.detail(pending.createdSymbolId).displayName).toBe(
      'Küstenzeichen'
    )
    expect(
      recovered.importAndAssign({
        commandId,
        displayName: 'Küstenzeichen',
        source,
        locationId: location.id,
        expectedSymbolRevision: 0,
        expectedPresentationRevision: 0
      }).status
    ).toBe('replayed')
    reopened.close()
  })

  it('resumes a pending deletion before removing the custom symbol', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-symbols-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    campaigns.create('Delete recovery')
    const lifecycle = new LocationSymbolLifecycleService(campaigns)
    const created = lifecycle.symbols.create(
      {
        displayName: 'Sturmzeichen',
        viewBox: { minX: 0, minY: 0, width: 10, height: 10 },
        pathData: 'M0 5 L10 5'
      },
      0
    )
    const symbolId = created.saved.id
    const location = new WorldLocationService(() =>
      campaigns.activeCampaignDatabase()
    ).create({ displayName: 'Sturmkap', tags: ['Kap'], notes: '' }, 0).snapshot
      .locations[0]!
    lifecycle
      .locationStore(campaigns.activeCampaignDatabase())
      .updateMapPresentation(location.id, { symbolId }, 0)
    new LocationSymbolStore(campaigns.installationDatabase()).beginDeletion(
      crypto.randomUUID(),
      symbolId,
      created.snapshot.revision
    )
    campaigns.close()

    const reopened = new CampaignStore(root)
    const recovered = new LocationSymbolLifecycleService(reopened)
    recovered.recoverPendingDeletions()
    expect(recovered.symbols.read().symbols).toEqual([])
    expect(
      recovered
        .locationStore(reopened.activeCampaignDatabase())
        .mapPresentation(location.id)
    ).toMatchObject({ symbolId: 'location', revision: 2 })
    reopened.close()
  })
})
