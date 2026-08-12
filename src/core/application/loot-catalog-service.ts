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
  index(reference: {
    catalogVersion: string
    catalogContentHash: string
  }): LootCatalogIndex
}>

export class LootCatalogService {
  constructor(private readonly catalog: LootCatalogPort) {}

  search(raw: LootCatalogQuery): LootCatalogPage {
    const query = lootCatalogQuerySchema.parse(raw)
    const run = this.catalog.readRun(query.runId)
    if (!run || run.runKind !== 'group_reward')
      throw new CapabilityError('not_found', false)
    if (run.catalogContentHash !== query.catalogContentHash)
      throw new CapabilityError('stale', true)
    const index = this.index(run.catalogVersion, run.catalogContentHash)
    const matching = index.search(query)
    return deepFreeze(
      lootCatalogPageSchema.parse({
        runId: run.id,
        catalogVersion: run.catalogVersion,
        catalogContentHash: run.catalogContentHash,
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
