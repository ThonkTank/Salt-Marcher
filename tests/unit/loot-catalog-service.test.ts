import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LootCatalogService } from '../../src/core/application/loot-catalog-service.js'
import { decimal } from '../../src/core/session-generation/rational.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import type { LootCatalogQuery } from '../../src/shared/contracts/loot.js'
import type { GeneratedRun } from '../../src/shared/contracts/session-generation.js'
import type { FullSessionGenerationCatalog } from '../../src/core/session-generation/loot-catalog.js'
import {
  createLootCatalogIndex,
  LootCatalogIndexCache
} from '../../src/core/loot/loot-catalog-index.js'

const runId = '0184d1f4-bba7-7c9c-9d89-5f1c0f36a031'
const provider = () =>
  new BundledEncounterCatalogProvider(
    join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
  )

function runFor(catalog: FullSessionGenerationCatalog): GeneratedRun {
  return {
    id: runId,
    runKind: 'group_reward',
    catalogVersion: catalog.encounter.catalogVersion,
    catalogContentHash: catalog.encounter.catalogContentHash
  } as GeneratedRun
}

function serviceFor(catalog: FullSessionGenerationCatalog): LootCatalogService {
  return new LootCatalogService({
    readRun: () => runFor(catalog),
    index: () => createLootCatalogIndex(catalog)
  })
}

function baseQuery(catalog: FullSessionGenerationCatalog): LootCatalogQuery {
  return {
    runId,
    catalogContentHash: catalog.encounter.catalogContentHash,
    search: '',
    types: [],
    categories: [],
    rarities: [],
    offset: 0,
    limit: 5
  }
}

describe('Loot catalog service', () => {
  it('searches, filters, sorts, and paginates active visible catalog entries', () => {
    const full = provider().loadFull()
    const service = serviceFor(full)
    const base = baseQuery(full)
    const first = service.search(base)
    const second = service.search({ ...base, offset: 5 })
    expect(first).toMatchObject({
      runId,
      catalogVersion: full.encounter.catalogVersion,
      catalogContentHash: full.encounter.catalogContentHash
    })
    expect(first.entries).toHaveLength(5)
    expect(second.entries).toHaveLength(5)
    expect(second.entries).not.toEqual(first.entries)
    expect([...first.entries].map((entry) => entry.defaultName)).toEqual(
      [...first.entries]
        .map((entry) => entry.defaultName)
        .toSorted((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    )
    expect(first.filterOptions.types).toContain('container')
    expect(first.filterOptions.rarities).toContain('Common')

    const magic = service.search({
      ...base,
      types: ['Arcana'],
      rarities: ['Common'],
      limit: 100
    })
    expect(magic.entries.length).toBeGreaterThan(0)
    expect(
      magic.entries.every(
        (entry) =>
          entry.kind === 'magic_item' &&
          entry.type === 'Arcana' &&
          entry.rarity === 'Common'
      )
    ).toBe(true)

    const named = service.search({ ...base, search: 'ABACUS', limit: 100 })
    expect(named.entries).toMatchObject([
      { kind: 'item', id: 'item:object:abacus', defaultName: 'Abacus' }
    ])
    const containers = service.search({
      ...base,
      types: ['container'],
      limit: 100
    })
    expect(
      containers.entries.some((entry) => entry.id === 'container:pocket')
    ).toBe(false)
    expect(
      containers.entries.some((entry) => entry.id === 'container:pouch')
    ).toBe(true)
  })

  it('rounds item copper values once and caches the index by content hash', () => {
    const full = provider().loadFull()
    const first = full.items[0]!
    const altered: FullSessionGenerationCatalog = {
      ...full,
      items: [
        {
          ...first,
          id: 'item:test:rounded',
          name: 'Rounded',
          baseCp: decimal('1.5'),
          active: true
        },
        {
          ...first,
          id: 'item:test:inactive',
          name: 'Inactive',
          active: false
        }
      ],
      magicItems: [],
      containers: []
    }
    let loads = 0
    const indexes = new LootCatalogIndexCache(() => {
      loads += 1
      return altered
    })
    const service = new LootCatalogService({
      readRun: () => runFor(altered),
      index: (reference) => indexes.require(reference)
    })
    const query = { ...baseQuery(altered), limit: 30 }
    expect(service.search(query).entries).toMatchObject([
      { id: 'item:test:rounded', unitValueCp: 2 }
    ])
    service.search(query)
    expect(loads).toBe(1)
  })

  it('binds queries to an existing group run and its expected hash', () => {
    const full = provider().loadFull()
    expect(() =>
      serviceFor(full).search({
        ...baseQuery(full),
        catalogContentHash: '0'.repeat(64)
      })
    ).toThrow(expect.objectContaining({ code: 'stale' }))
    expect(() =>
      new LootCatalogService({
        readRun: () => null,
        index: () => createLootCatalogIndex(full)
      }).search(baseQuery(full))
    ).toThrow(expect.objectContaining({ code: 'not_found' }))
  })
})
