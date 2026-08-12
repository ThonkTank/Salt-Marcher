import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LootCatalogService } from '../../src/core/application/loot-catalog-service.js'
import { decimal } from '../../src/core/session-generation/rational.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import type { LootCatalogQuery } from '../../src/shared/contracts/loot.js'

const provider = () =>
  new BundledEncounterCatalogProvider(
    join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
  )

describe('Loot catalog service', () => {
  it('searches, filters, sorts, and paginates active visible catalog entries', () => {
    const catalog = provider()
    const full = catalog.loadFull()
    const service = new LootCatalogService(catalog)
    const base: LootCatalogQuery = {
      catalogContentHash: full.encounter.catalogContentHash,
      search: '',
      types: [],
      categories: [],
      rarities: [],
      offset: 0,
      limit: 5
    }
    const first = service.search(base)
    const second = service.search({ ...base, offset: 5 })
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

    const named = service.search({
      ...base,
      search: 'abacus',
      limit: 100
    })
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

  it('rounds item copper values half-up and excludes inactive rows', () => {
    const full = provider().loadFull()
    const first = full.items[0]!
    const service = new LootCatalogService({
      loadFull: () => ({
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
      })
    })
    const page = service.search({
      catalogContentHash: full.encounter.catalogContentHash,
      search: '',
      types: [],
      categories: [],
      rarities: [],
      offset: 0,
      limit: 30
    })
    expect(page.entries).toMatchObject([
      { id: 'item:test:rounded', unitValueCp: 2 }
    ])
  })

  it('rejects a catalog hash other than the verified snapshot', () => {
    const catalog = provider()
    const service = new LootCatalogService(catalog)
    expect(() =>
      service.search({
        catalogContentHash: '0'.repeat(64),
        search: '',
        types: [],
        categories: [],
        rarities: [],
        offset: 0,
        limit: 30
      })
    ).toThrow(expect.objectContaining({ code: 'stale' }))
  })
})
