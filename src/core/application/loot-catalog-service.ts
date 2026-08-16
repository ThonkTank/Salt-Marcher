import {
  lootCatalogPageSchema,
  lootCatalogQuerySchema,
  type LootCatalogPage,
  type LootCatalogQuery
} from '../../shared/contracts/loot.js'
import type { GeneratedRun } from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { type LootCatalogIndex } from '../loot/loot-catalog-index.js'

export type LootCatalogPort = Readonly<{
  readRun(runId: string): GeneratedRun | null
  currentReference?(): {
    catalogVersion: string
    catalogContentHash: string
  }
  index(reference: {
    catalogVersion: string
    catalogContentHash: string
  }): LootCatalogIndex
}>

export class LootCatalogService {
  constructor(private readonly catalog: LootCatalogPort) {}

  search(raw: LootCatalogQuery): LootCatalogPage {
    const query = lootCatalogQuerySchema.parse(raw)
    const run = query.runId ? this.catalog.readRun(query.runId) : null
    if (query.runId && (!run || run.runKind !== 'group_reward'))
      throw new CapabilityError('not_found', false)
    if (run && run.catalogContentHash !== query.catalogContentHash)
      throw new CapabilityError('stale', true)
    const reference = run ?? this.catalog.currentReference?.()
    if (!reference) throw new CapabilityError('catalog_unavailable', false)
    if (
      !run &&
      query.catalogContentHash &&
      query.catalogContentHash !== reference.catalogContentHash
    )
      throw new CapabilityError('stale', true)
    const index = this.index(
      reference.catalogVersion,
      reference.catalogContentHash
    )
    const matching = index.search(query)
    return deepFreeze(
      lootCatalogPageSchema.parse({
        runId: run?.id ?? null,
        catalogVersion: reference.catalogVersion,
        catalogContentHash: reference.catalogContentHash,
        entries: matching.slice(query.offset, query.offset + query.limit),
        total: matching.length,
        offset: query.offset,
        limit: query.limit,
        filterOptions: index.filterOptions
      })
    )
  }

  private index(version: string, hash: string): LootCatalogIndex {
    return this.catalog.index({
      catalogVersion: version,
      catalogContentHash: hash
    })
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
