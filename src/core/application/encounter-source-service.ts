import Database from 'better-sqlite3'
import type { CreatureCatalogQuery } from '../../shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableScope,
  WorldFaction,
  WorldFactionDraft
} from '../../shared/contracts/encounter-source.js'
import { EncounterTableStore } from '../encounter/encounter-table-store.js'
import { WorldFactionStore } from '../worldplanner/faction-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { encounterTableSnapshotSchema } from '../../shared/contracts/encounter-source.js'
import { anyBiomeEncounterTableId } from '../../shared/contracts/biome.js'
import { BiomeCatalogStore } from '../biomes/biome-catalog.js'

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
  biomeFiltering: boolean
}>

/** Coordinates aggregate-owned stores and recoverable cross-database lifecycles. */
export class EncounterSourceService {
  constructor(
    private readonly campaignDatabase: () => Database.Database,
    private readonly installationDatabase?: () => Database.Database,
    private readonly visitCampaignDatabases?: (
      visitor: (campaign: { id: string; database: Database.Database }) => void
    ) => void
  ) {}

  readTables() {
    const campaign = this.withStores(({ tables }) => tables.read())
    const installation = this.installationTables()?.read()
    return encounterTableSnapshotSchema.parse({
      revision: Math.max(campaign.revision, installation?.revision ?? 0),
      installationRevision: installation?.revision ?? 0,
      campaignRevision: campaign.revision,
      tables: [...(installation?.tables ?? []), ...campaign.tables]
    })
  }

  createTable(
    commandId: string,
    draft: EncounterTableDraft,
    revision: number,
    scope: EncounterTableScope = 'campaign'
  ) {
    if (scope === 'installation') {
      const tables = this.requireInstallationTables()
      tables.create(commandId, draft, revision)
      return this.readTables()
    }
    this.withStores(({ tables }) => tables.create(commandId, draft, revision))
    return this.readTables()
  }

  updateTable(
    commandId: string,
    id: string,
    draft: EncounterTableDraft,
    revision: number,
    scope: EncounterTableScope = 'campaign'
  ) {
    if (scope === 'installation') {
      const tables = this.requireInstallationTables()
      tables.beginInstallationLifecycle({
        commandId,
        operation: 'update',
        tableId: id,
        expectedRevision: revision,
        draft
      })
      tables.update(commandId, id, draft, revision)
      this.visitCampaignDatabases?.(({ id: campaignId, database }) => {
        tables.beginCampaignLifecycle(commandId, campaignId)
        if (tables.campaignLifecycleCompleted(commandId, campaignId)) return
        database.transaction(() => {
          campaignFactionStore(database, tables).pruneInventoryForTable(
            id,
            draft.entries.map((entry) => entry.creatureId)
          )
        })()
        tables.completeCampaignLifecycle(commandId, campaignId)
      })
      tables.completeInstallationLifecycle(commandId)
      return this.readTables()
    }
    return this.withStores(({ db, tables, factions }) => {
      db.transaction(() => {
        tables.update(commandId, id, draft, revision)
        factions.pruneInventoryForTable(
          id,
          draft.entries.map((entry) => entry.creatureId)
        )
      })()
      return this.readTables()
    })
  }

  deleteTable(
    commandId: string,
    id: string,
    revision: number,
    scope: EncounterTableScope = 'campaign'
  ) {
    if (scope === 'installation') {
      const db = this.installationDatabase?.()
      if (!db) throw new Error('Installation encounter tables unavailable')
      const tables = this.requireInstallationTables()
      tables.beginInstallationLifecycle({
        commandId,
        operation: 'delete',
        tableId: id,
        expectedRevision: revision
      })
      tables.delete(commandId, id, revision)
      new BiomeCatalogStore(db).unlinkEncounterTable(id)
      this.visitCampaignDatabases?.(({ id: campaignId, database }) => {
        tables.beginCampaignLifecycle(commandId, campaignId)
        if (tables.campaignLifecycleCompleted(commandId, campaignId)) return
        database.transaction(() => {
          campaignFactionStore(database, tables).clearPrimaryEncounterTable(id)
          new WorldLocationStore(database).unlinkEncounterTable(id)
        })()
        tables.completeCampaignLifecycle(commandId, campaignId)
      })
      tables.completeInstallationLifecycle(commandId)
      return this.readTables()
    }
    return this.withStores(({ db, tables, factions, locations }) => {
      db.transaction(() => {
        tables.delete(commandId, id, revision)
        factions.clearPrimaryEncounterTable(id)
        locations.unlinkEncounterTable(id)
      })()
      return this.readTables()
    })
  }

  recoverPendingInstallationTableLifecycles(): void {
    const tables = this.installationTables()
    if (!tables) return
    for (const job of tables.pendingInstallationLifecycles()) {
      if (job.operation === 'update') {
        if (!job.draft)
          throw new Error('Encounter update lifecycle has no draft')
        this.updateTable(
          job.commandId,
          job.tableId,
          job.draft,
          job.expectedRevision,
          'installation'
        )
      } else
        this.deleteTable(
          job.commandId,
          job.tableId,
          job.expectedRevision,
          'installation'
        )
    }
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
    return this.withStores(({ factions, locations }) =>
      resolveEncounterSource(
        query,
        this.readTables().tables,
        factions.read().factions,
        locations.read().locations,
        this.installationDatabase?.()
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
    const installationTables = this.installationTables()
    return work({
      db,
      tables,
      factions: new WorldFactionStore(db, {
        containsTable: (id) =>
          tables.contains(id) || Boolean(installationTables?.contains(id)),
        containsCreature: (tableId, creatureId) =>
          tables.containsCreature(tableId, creatureId) ||
          Boolean(installationTables?.containsCreature(tableId, creatureId))
      }),
      locations: new WorldLocationStore(db)
    })
  }

  private installationTables(): EncounterTableStore | null {
    const db = this.installationDatabase?.()
    return db ? new EncounterTableStore(db, 'installation') : null
  }

  private requireInstallationTables(): EncounterTableStore {
    const tables = this.installationTables()
    if (!tables) throw new Error('Installation encounter tables unavailable')
    return tables
  }
}

function campaignFactionStore(
  db: Database.Database,
  installationTables: EncounterTableStore
): WorldFactionStore {
  const campaignTables = new EncounterTableStore(db)
  return new WorldFactionStore(db, {
    containsTable: (id) =>
      campaignTables.contains(id) || installationTables.contains(id),
    containsCreature: (tableId, creatureId) =>
      campaignTables.containsCreature(tableId, creatureId) ||
      installationTables.containsCreature(tableId, creatureId)
  })
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
  }[],
  installationDatabase?: Database.Database
): ResolvedEncounterSource {
  const tableById = new Map(tables.map((table) => [table.id, table]))
  const factionById = new Map(factions.map((faction) => [faction.id, faction]))
  const dimensions: Dimension[] = []
  const effectiveTables = new Set<string>()
  const effectiveFactions = new Set<string>()

  if (query.biomes.length > 0 && installationDatabase) {
    dimensions.push(
      biomeSourceDimension(
        query.biomes,
        tableById,
        effectiveTables,
        installationDatabase
      )
    )
  }

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
      catalogFallback: true,
      biomeFiltering: installationDatabase !== undefined
    }

  return {
    candidates: [...intersectDimensions(dimensions)].map(
      ([creatureId, value]) => ({ creatureId, ...value })
    ),
    effectiveEncounterTableIds: [...effectiveTables],
    effectiveFactionIds: [...effectiveFactions],
    locationId: query.locationId,
    catalogFallback: false,
    biomeFiltering: installationDatabase !== undefined
  }
}

function biomeSourceDimension(
  biomeIds: readonly string[],
  tables: ReadonlyMap<string, EncounterTable>,
  effective: Set<string>,
  db: Database.Database
): Dimension {
  const linked = new BiomeCatalogStore(db).encounterTableIdsForBiomes(biomeIds)
  const result = tableDimension(linked, tables, effective)
  const any = tableDimension([anyBiomeEncounterTableId], tables, effective)
  for (const [id, value] of any) {
    const current = result.get(id)
    result.set(id, {
      weight: Math.max(current?.weight ?? 0, value.weight),
      maximum: current?.maximum ?? value.maximum
    })
  }
  return result
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
