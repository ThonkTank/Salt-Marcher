import Database from 'better-sqlite3'
import type { CreatureCatalogQuery } from '../../shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableCommandReceipt,
  EncounterTableDeleteReceipt,
  EncounterTableDraft,
  EncounterTableMutationReceipt,
  EncounterTableScope,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDraft
} from '../../shared/contracts/encounter-source.js'
import {
  encounterTableDeleteReceiptSchema,
  encounterTableMutationReceiptSchema,
  encounterTableSnapshotSchema,
  encounterTableSummarySchema,
  worldFactionDeleteReceiptSchema
} from '../../shared/contracts/encounter-source.js'
import { EncounterTableStore } from '../encounter/encounter-table-store.js'
import { WorldFactionStore } from '../worldplanner/faction-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { WorldNpcStore } from '../worldplanner/npc-store.js'
import type { WorldNpcDraft } from '../../shared/contracts/world-npc.js'
import { anyBiomeEncounterTableId } from '../../shared/contracts/biome.js'
import { BiomeCatalogStore } from '../biomes/biome-catalog.js'
import { creatureById } from '../creatures/catalog.js'

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
  sourceIssue: 'location_missing_table' | 'location_empty_table' | null
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
      installation: scopeProjection(
        installation?.revision ?? 0,
        installation?.tables ?? []
      ),
      campaign: scopeProjection(campaign.revision, campaign.tables)
    })
  }

  tableReceipt(commandId: string) {
    const campaignTables = this.withStores(({ tables }) => tables)
    const installationTables = this.installationTables()
    const campaign = campaignTables.commandReceipt(commandId)
    const installation = installationTables?.commandReceipt(commandId)
    if (campaign && installation)
      throw new Error('Encounter Table command identity exists in both scopes.')
    const receipt = campaign ?? installation
    if (!receipt) return null
    const owner = campaign ? campaignTables : installationTables!
    const completed = owner.applicationReceipt(commandId)
    if (completed) return completed
    const reconstructed =
      'saved' in receipt
        ? encounterTableMutationReceiptSchema.parse({
            snapshot: this.readTables(),
            saved: receipt.saved
          })
        : encounterTableDeleteReceiptSchema.parse({
            snapshot: this.readTables(),
            deletedId: receipt.deletedId
          })
    return owner.completeApplicationReceipt(commandId, reconstructed)
  }

  createTable(
    commandId: string,
    draft: EncounterTableDraft,
    revision: number,
    scope: EncounterTableScope = 'campaign'
  ) {
    if (scope === 'installation') {
      const tables = this.requireInstallationTables()
      const result = tables.create(commandId, draft, revision)
      return this.completeTableMutationReceipt(tables, commandId, result.saved)
    }
    const result = this.withStores(({ tables }) =>
      tables.create(commandId, draft, revision)
    )
    return this.withStores(({ tables }) =>
      this.completeTableMutationReceipt(tables, commandId, result.saved)
    )
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
      const result = tables.update(commandId, id, draft, revision)
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
      return this.completeTableMutationReceipt(tables, commandId, result.saved)
    }
    const result = this.withStores(({ db, tables, factions }) => {
      let saved: EncounterTable | null = null
      db.transaction(() => {
        saved = tables.update(commandId, id, draft, revision).saved
        factions.pruneInventoryForTable(
          id,
          draft.entries.map((entry) => entry.creatureId)
        )
      })()
      if (!saved) throw new Error('Updated Encounter Table is missing.')
      return saved
    })
    return this.withStores(({ tables }) =>
      this.completeTableMutationReceipt(tables, commandId, result)
    )
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
      return this.completeTableDeleteReceipt(tables, commandId, id)
    }
    this.withStores(({ db, tables, factions, locations }) => {
      db.transaction(() => {
        tables.delete(commandId, id, revision)
        factions.clearPrimaryEncounterTable(id)
        locations.unlinkEncounterTable(id)
      })()
    })
    return this.withStores(({ tables }) =>
      this.completeTableDeleteReceipt(tables, commandId, id)
    )
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

  readNpcs() {
    return this.withStores(({ npcs }) => npcs.read())
  }

  npcReceipt(commandId: string) {
    return this.withStores(({ npcs }) => npcs.commandReceipt(commandId))
  }

  createNpc(
    commandId: string,
    draft: WorldNpcDraft,
    revision: number,
    factionRevision: number
  ) {
    return this.withStores(({ npcs }) =>
      npcs.create(commandId, draft, revision, factionRevision)
    )
  }

  updateNpc(
    commandId: string,
    id: string,
    draft: WorldNpcDraft,
    revision: number,
    factionRevision: number
  ) {
    return this.withStores(({ npcs }) =>
      npcs.update(commandId, id, draft, revision, factionRevision)
    )
  }

  deleteNpc(
    commandId: string,
    id: string,
    revision: number,
    factionRevision: number
  ) {
    return this.withStores(({ npcs }) =>
      npcs.delete(commandId, id, revision, factionRevision)
    )
  }

  factionReceipt(commandId: string) {
    return this.withStores(({ factions }) => factions.commandReceipt(commandId))
  }

  createFaction(commandId: string, draft: WorldFactionDraft, revision: number) {
    return this.withStores(({ factions }) =>
      factions.create(commandId, draft, revision)
    )
  }

  updateFaction(
    commandId: string,
    id: string,
    draft: WorldFactionDraft,
    revision: number
  ) {
    return this.withStores(({ factions }) =>
      factions.update(commandId, id, draft, revision)
    )
  }

  deleteFaction(commandId: string, id: string, revision: number) {
    return this.withStores(({ db, factions, locations, npcs }) => {
      let receipt: ReturnType<WorldFactionStore['delete']> | null = null
      db.transaction(() => {
        receipt = factions.delete(commandId, id, revision)
        locations.unlinkFaction(id)
        npcs.unlinkFaction(id)
      })()
      if (!receipt) throw new Error('Deleted World Faction receipt is missing.')
      return worldFactionDeleteReceiptSchema.parse(receipt)
    })
  }

  resolve(query: CreatureCatalogQuery): ResolvedEncounterSource {
    return this.withStores(({ factions, locations }) =>
      resolveEncounterSource(
        query,
        allTables(this.readTables()),
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
      npcs: WorldNpcStore
    }) => T
  ): T {
    const db = this.campaignDatabase()
    const tables = new EncounterTableStore(db)
    const installationTables = this.installationTables()
    const factions = new WorldFactionStore(db, {
      containsTable: (id) =>
        tables.contains(id) || Boolean(installationTables?.contains(id)),
      containsCreature: (tableId, creatureId) =>
        tables.containsCreature(tableId, creatureId) ||
        Boolean(installationTables?.containsCreature(tableId, creatureId))
    })
    return work({
      db,
      tables,
      factions,
      locations: new WorldLocationStore(db),
      npcs: new WorldNpcStore(db, factions)
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

  private completeTableMutationReceipt(
    tables: EncounterTableStore,
    commandId: string,
    saved: EncounterTable
  ): EncounterTableMutationReceipt {
    return encounterTableMutationReceiptSchema.parse(
      this.completeTableReceipt(tables, commandId, {
        snapshot: this.readTables(),
        saved
      })
    )
  }

  private completeTableDeleteReceipt(
    tables: EncounterTableStore,
    commandId: string,
    deletedId: string
  ): EncounterTableDeleteReceipt {
    return encounterTableDeleteReceiptSchema.parse(
      this.completeTableReceipt(tables, commandId, {
        snapshot: this.readTables(),
        deletedId
      })
    )
  }

  private completeTableReceipt(
    tables: EncounterTableStore,
    commandId: string,
    receipt: EncounterTableCommandReceipt
  ): EncounterTableCommandReceipt {
    return tables.completeApplicationReceipt(commandId, receipt)
  }
}

function scopeProjection(revision: number, tables: readonly EncounterTable[]) {
  return {
    revision,
    tables,
    summaries: tables.map((table) => summarizeTable(table))
  }
}

function summarizeTable(table: EncounterTable) {
  const facts = table.entries
    .map((entry) => creatureById(entry.creatureId))
    .filter((creature) => creature !== undefined)
    .toSorted(
      (left, right) => left.cr - right.cr || left.id.localeCompare(right.id)
    )
  const first = facts[0]
  const last = facts.at(-1)
  return encounterTableSummarySchema.parse({
    id: table.id,
    scope: table.scope,
    displayName: table.displayName,
    entryCount: table.entries.length,
    challengeRatingRange:
      first && last
        ? {
            minimum: first.challengeRating,
            maximum: last.challengeRating
          }
        : null,
    biomes: [
      ...new Set(facts.flatMap((creature) => creature.biomes))
    ].toSorted()
  })
}

function allTables(snapshot: EncounterTableSnapshot) {
  return [...snapshot.installation.tables, ...snapshot.campaign.tables]
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
  let sourceIssue: ResolvedEncounterSource['sourceIssue'] = null

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
    if (!location || location.encounterTableIds.length === 0) {
      sourceIssue = 'location_missing_table'
    } else {
      const locationTables = location.encounterTableIds.map((id) =>
        tableById.get(id)
      )
      if (
        locationTables.some(
          (table) => table === undefined || table.entries.length === 0
        )
      )
        sourceIssue = 'location_empty_table'
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
      candidates: sourceIssue === null ? null : [],
      effectiveEncounterTableIds: [],
      effectiveFactionIds: [...effectiveFactions],
      locationId: query.locationId,
      catalogFallback: sourceIssue === null,
      biomeFiltering: installationDatabase !== undefined,
      sourceIssue
    }

  const candidates = [...intersectDimensions(dimensions)].map(
    ([creatureId, value]) => ({ creatureId, ...value })
  )
  return {
    candidates: sourceIssue === null ? candidates : [],
    effectiveEncounterTableIds: [...effectiveTables],
    effectiveFactionIds: [...effectiveFactions],
    locationId: query.locationId,
    catalogFallback: false,
    biomeFiltering: installationDatabase !== undefined,
    sourceIssue
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
