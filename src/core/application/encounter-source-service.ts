import Database from 'better-sqlite3'
import type { CreatureCatalogQuery } from '../../shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  WorldFaction,
  WorldFactionDraft
} from '../../shared/contracts/encounter-source.js'
import { EncounterTableStore } from '../encounter/encounter-table-store.js'
import { WorldFactionStore } from '../worldplanner/faction-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'

export type ResolvedSourceCandidate = Readonly<{
  creatureId: string
  weight: number
  maximum: number | null
}>

export type ResolvedEncounterSource = Readonly<{
  candidates: readonly ResolvedSourceCandidate[] | null
  effectiveEncounterTableIds: readonly string[]
  effectiveFactionIds: readonly string[]
  locationId: string | null
  catalogFallback: boolean
}>

/** Coordinates aggregate-owned stores; all cross-aggregate work is transactional. */
export class EncounterSourceService {
  constructor(private readonly campaignDatabase: () => Database.Database) {}

  readTables() {
    return this.withStores(({ tables }) => tables.read())
  }

  createTable(draft: EncounterTableDraft, revision: number) {
    return this.withStores(({ tables }) => tables.create(draft, revision))
  }

  updateTable(id: string, draft: EncounterTableDraft, revision: number) {
    return this.withStores(({ db, tables, factions }) => {
      db.transaction(() => {
        tables.update(id, draft, revision)
        factions.pruneInventoryForTable(
          id,
          draft.entries.map((entry) => entry.creatureId)
        )
      })()
      return tables.read()
    })
  }

  deleteTable(id: string, revision: number) {
    return this.withStores(({ db, tables, factions, locations }) => {
      db.transaction(() => {
        tables.delete(id, revision)
        factions.clearPrimaryEncounterTable(id)
        locations.unlinkEncounterTable(id)
      })()
      return tables.read()
    })
  }

  readFactions() {
    return this.withStores(({ factions }) => factions.read())
  }

  createFaction(draft: WorldFactionDraft, revision: number) {
    return this.withStores(({ factions }) => factions.create(draft, revision))
  }

  updateFaction(id: string, draft: WorldFactionDraft, revision: number) {
    return this.withStores(({ factions }) =>
      factions.update(id, draft, revision)
    )
  }

  deleteFaction(id: string, revision: number) {
    return this.withStores(({ db, factions, locations }) => {
      db.transaction(() => {
        factions.delete(id, revision)
        locations.unlinkFaction(id)
      })()
      return factions.read()
    })
  }

  resolve(query: CreatureCatalogQuery): ResolvedEncounterSource {
    return this.withStores(({ tables, factions, locations }) =>
      resolveEncounterSource(
        query,
        tables.read().tables,
        factions.read().factions,
        locations.read().locations
      )
    )
  }

  private withStores<T>(
    work: (stores: {
      db: Database.Database
      tables: EncounterTableStore
      factions: WorldFactionStore
      locations: WorldLocationStore
    }) => T
  ): T {
    const db = this.campaignDatabase()
    const tables = new EncounterTableStore(db)
    return work({
      db,
      tables,
      factions: new WorldFactionStore(db, {
        containsTable: (id) => tables.contains(id),
        containsCreature: (tableId, creatureId) =>
          tables.containsCreature(tableId, creatureId)
      }),
      locations: new WorldLocationStore(db)
    })
  }
}

type Dimension = Map<string, { weight: number; maximum: number | null }>

export function resolveEncounterSource(
  query: CreatureCatalogQuery,
  tables: readonly EncounterTable[],
  factions: readonly WorldFaction[],
  locations: readonly {
    id: string
    factionIds: readonly string[]
    encounterTableIds: readonly string[]
  }[]
): ResolvedEncounterSource {
  const tableById = new Map(tables.map((table) => [table.id, table]))
  const factionById = new Map(factions.map((faction) => [faction.id, faction]))
  const dimensions: Dimension[] = []
  const effectiveTables = new Set<string>()
  const effectiveFactions = new Set<string>()

  addTableDimension(
    query.encounterTableIds,
    tableById,
    effectiveTables,
    dimensions
  )
  addFactionDimension(
    query.factionIds,
    tableById,
    factionById,
    effectiveTables,
    effectiveFactions,
    dimensions
  )

  if (query.locationId !== null) {
    const location = locations.find((value) => value.id === query.locationId)
    if (location) {
      const before = effectiveTables.size
      const fromTables = tableDimension(
        location.encounterTableIds,
        tableById,
        effectiveTables
      )
      const fromFactions = factionDimension(
        location.factionIds,
        tableById,
        factionById,
        effectiveTables,
        effectiveFactions
      )
      if (effectiveTables.size > before)
        dimensions.push(unionDimensions(fromTables, fromFactions))
    }
  }

  if (effectiveTables.size === 0)
    return {
      candidates: null,
      effectiveEncounterTableIds: [],
      effectiveFactionIds: [...effectiveFactions],
      locationId: query.locationId,
      catalogFallback: true
    }

  return {
    candidates: [...intersectDimensions(dimensions)].map(
      ([creatureId, value]) => ({ creatureId, ...value })
    ),
    effectiveEncounterTableIds: [...effectiveTables],
    effectiveFactionIds: [...effectiveFactions],
    locationId: query.locationId,
    catalogFallback: false
  }
}

function addTableDimension(
  ids: readonly string[],
  tables: ReadonlyMap<string, EncounterTable>,
  effective: Set<string>,
  dimensions: Dimension[]
): void {
  const before = effective.size
  const dimension = tableDimension(ids, tables, effective)
  if (effective.size > before) dimensions.push(dimension)
}

function addFactionDimension(
  ids: readonly string[],
  tables: ReadonlyMap<string, EncounterTable>,
  factions: ReadonlyMap<string, WorldFaction>,
  effectiveTables: Set<string>,
  effectiveFactions: Set<string>,
  dimensions: Dimension[]
): void {
  const before = effectiveTables.size
  const dimension = factionDimension(
    ids,
    tables,
    factions,
    effectiveTables,
    effectiveFactions
  )
  if (effectiveTables.size > before) dimensions.push(dimension)
}

function tableDimension(
  ids: readonly string[],
  tables: ReadonlyMap<string, EncounterTable>,
  effective: Set<string>
): Dimension {
  const result: Dimension = new Map()
  for (const id of new Set(ids)) {
    const table = tables.get(id)
    if (!table) continue
    effective.add(id)
    for (const entry of table.entries) {
      const current = result.get(entry.creatureId)
      result.set(entry.creatureId, {
        weight: (current?.weight ?? 0) + entry.weight,
        maximum: null
      })
    }
  }
  return result
}

function factionDimension(
  ids: readonly string[],
  tables: ReadonlyMap<string, EncounterTable>,
  factions: ReadonlyMap<string, WorldFaction>,
  effectiveTables: Set<string>,
  effectiveFactions: Set<string>
): Dimension {
  const result: Dimension = new Map()
  for (const id of new Set(ids)) {
    const faction = factions.get(id)
    if (!faction) continue
    effectiveFactions.add(id)
    if (faction.primaryEncounterTableId === null) continue
    const table = tables.get(faction.primaryEncounterTableId)
    if (!table) continue
    effectiveTables.add(table.id)
    const inventory = new Map(
      faction.inventory.map((entry) => [entry.creatureId, entry.maximum])
    )
    for (const entry of table.entries) {
      const current = result.get(entry.creatureId)
      const maximum = inventory.get(entry.creatureId)
      result.set(entry.creatureId, {
        weight: (current?.weight ?? 0) + entry.weight,
        maximum:
          current?.maximum === null || maximum === undefined
            ? null
            : (current?.maximum ?? 0) + maximum
      })
    }
  }
  return result
}

function unionDimensions(...dimensions: readonly Dimension[]): Dimension {
  const result: Dimension = new Map()
  for (const dimension of dimensions)
    for (const [id, value] of dimension) {
      const current = result.get(id)
      result.set(id, {
        weight: (current?.weight ?? 0) + value.weight,
        maximum:
          current?.maximum === null || value.maximum === null
            ? null
            : (current?.maximum ?? 0) + value.maximum
      })
    }
  return result
}

function intersectDimensions(dimensions: readonly Dimension[]): Dimension {
  if (dimensions.length === 0) return new Map()
  const result = new Map(dimensions[0])
  for (const dimension of dimensions.slice(1))
    for (const [id, current] of result) {
      const other = dimension.get(id)
      if (!other) result.delete(id)
      else
        result.set(id, {
          weight: Math.min(current.weight, other.weight),
          maximum:
            current.maximum === null
              ? other.maximum
              : other.maximum === null
                ? current.maximum
                : Math.min(current.maximum, other.maximum)
        })
    }
  return result
}
