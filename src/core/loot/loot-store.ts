import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  treasureSchema,
  type ParsedCreateTreasureInput,
  type MoveTreasureInput,
  type Treasure,
  type TreasureAnchor,
  type TreasureContainerDraft,
  type TreasureItemDraft,
  type ParsedUpdateTreasureInput
} from '../../shared/contracts/loot.js'
import type {
  GeneratedRun,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import {
  buildTreasureAggregateDiff,
  type TreasureAggregateDiff
} from './treasure-aggregate-diff.js'
import type { MaterializedGroupRewardTreasureDraft } from './group-reward-treasure-draft.js'

export function initializeLootSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loot_treasure (
      id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      label TEXT NOT NULL,
      anchor_kind TEXT NOT NULL CHECK(anchor_kind IN ('unplaced', 'location', 'group')),
      location_id TEXT,
      scene_id TEXT,
      group_id TEXT,
      last_known_label TEXT,
      source_kind TEXT NOT NULL CHECK(source_kind IN ('manual', 'generated')),
      source_run_id TEXT,
      source_treasure_id TEXT,
      distribution_state TEXT NOT NULL DEFAULT 'open'
        CHECK(distribution_state IN ('open', 'partial', 'complete')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_run_id, source_treasure_id),
      CHECK(
        (anchor_kind = 'unplaced' AND location_id IS NULL AND scene_id IS NULL AND group_id IS NULL AND last_known_label IS NULL)
        OR
        (anchor_kind = 'location' AND location_id IS NOT NULL AND scene_id IS NULL AND group_id IS NULL AND last_known_label IS NOT NULL)
        OR
        (anchor_kind = 'group' AND location_id IS NULL AND scene_id IS NOT NULL AND group_id IS NOT NULL AND last_known_label IS NOT NULL)
      ),
      CHECK(
        (source_kind = 'manual' AND source_run_id IS NULL AND source_treasure_id IS NULL)
        OR
        (source_kind = 'generated' AND source_run_id IS NOT NULL AND source_treasure_id IS NOT NULL)
      )
    );
    CREATE TABLE IF NOT EXISTS loot_container (
      id TEXT PRIMARY KEY NOT NULL,
      treasure_id TEXT NOT NULL REFERENCES loot_treasure(id) ON DELETE CASCADE,
      catalog_container_id TEXT,
      name TEXT NOT NULL,
      capacity REAL NOT NULL CHECK(capacity >= 0),
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(treasure_id, position)
    );
    CREATE TABLE IF NOT EXISTS loot_item (
      id TEXT PRIMARY KEY NOT NULL,
      treasure_id TEXT NOT NULL REFERENCES loot_treasure(id) ON DELETE CASCADE,
      source_line_id TEXT,
      catalog_item_id TEXT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_value_cp INTEGER NOT NULL CHECK(unit_value_cp >= 0),
      stackable INTEGER NOT NULL CHECK(stackable IN (0, 1)),
      magic INTEGER NOT NULL CHECK(magic IN (0, 1)),
      rarity TEXT,
      curse_name TEXT,
      container_id TEXT REFERENCES loot_container(id) ON DELETE SET NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(treasure_id, position)
    );
    CREATE TABLE IF NOT EXISTS loot_allocation (
      id TEXT PRIMARY KEY NOT NULL,
      command_id TEXT NOT NULL,
      treasure_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      created_at TEXT NOT NULL,
      UNIQUE(command_id, item_id, character_id)
    );
    CREATE INDEX IF NOT EXISTS loot_allocation_item
      ON loot_allocation(item_id, created_at, id);
    CREATE INDEX IF NOT EXISTS loot_treasure_location
      ON loot_treasure(anchor_kind, location_id, updated_at, id);
    CREATE INDEX IF NOT EXISTS loot_treasure_group
      ON loot_treasure(anchor_kind, scene_id, group_id, updated_at, id);
    CREATE TABLE IF NOT EXISTS loot_operation_receipt (
      command_id TEXT PRIMARY KEY NOT NULL,
      operation_type TEXT NOT NULL CHECK(operation_type IN (
        'create','update','move','accept_generated','commit_group_reward',
        'distribute','correct_ledger'
      )),
      request_fingerprint TEXT NOT NULL,
      target_id TEXT NOT NULL,
      result_schema_version INTEGER NOT NULL CHECK(result_schema_version = 1),
      result_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS loot_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    INSERT OR IGNORE INTO loot_metadata (singleton, revision)
      VALUES (1, 0);
  `)
}

type TreasureRow = Readonly<{
  id: string
  revision: number
  label: string
  anchorKind: 'unplaced' | 'location' | 'group'
  locationId: string | null
  sceneId: string | null
  groupId: string | null
  lastKnownLabel: string | null
  sourceKind: 'manual' | 'generated'
  sourceRunId: string | null
  sourceTreasureId: string | null
  distributionState: 'open' | 'partial' | 'complete'
  createdAt: string
  updatedAt: string
}>

export class TreasureStore {
  constructor(private readonly db: Database.Database) {}

  read(id: string): Treasure | null {
    const row = this.row(id)
    return row ? this.project(row) : null
  }

  require(id: string): Treasure {
    const treasure = this.read(id)
    if (!treasure) throw new CapabilityError('not_found', false)
    return treasure
  }

  findByGenerated(runId: string, generatedTreasureId: string): Treasure | null {
    const row = this.db
      .prepare(
        `SELECT id FROM loot_treasure
          WHERE source_run_id = ? AND source_treasure_id = ?`
      )
      .get(runId, generatedTreasureId) as { id: string } | undefined
    return row ? this.read(row.id) : null
  }

  createManual(input: ParsedCreateTreasureInput, now: string): Treasure {
    const id = uuidv7()
    this.insertTreasure({
      id,
      label: input.label.trim(),
      anchor: input.anchor,
      sourceKind: 'manual',
      sourceRunId: null,
      sourceTreasureId: null,
      now
    })
    input.containers.forEach((container, position) =>
      this.insertManualContainer(id, container, position)
    )
    input.items.forEach((item, position) =>
      this.insertManualItem(id, item, position)
    )
    return this.require(id)
  }

  acceptGenerated(
    run: GeneratedRun,
    generated: GeneratedTreasure,
    label: string,
    anchor: TreasureAnchor,
    now: string
  ): Treasure {
    const existing = this.db
      .prepare(
        `SELECT id FROM loot_treasure
         WHERE source_run_id = ? AND source_treasure_id = ?`
      )
      .get(run.id, generated.id) as { id: string } | undefined
    if (existing) {
      return this.require(existing.id)
    }
    const id = uuidv7()
    this.insertTreasure({
      id,
      label: label.trim(),
      anchor,
      sourceKind: 'generated',
      sourceRunId: run.id,
      sourceTreasureId: generated.id,
      now
    })
    const containerIds = new Map<string, string>()
    generated.containers.forEach((container, position) => {
      const containerId = uuidv7()
      containerIds.set(container.id, containerId)
      this.db
        .prepare(
          `INSERT INTO loot_container (
             id, treasure_id, catalog_container_id, name, capacity, position
           ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          containerId,
          id,
          container.catalogContainerId,
          container.name,
          container.capacity,
          position
        )
    })
    generated.items.forEach((item, position) =>
      this.db
        .prepare(
          `INSERT INTO loot_item (
             id, treasure_id, source_line_id, catalog_item_id, name, quantity,
             unit_value_cp, stackable, magic, rarity, curse_name, container_id,
             position
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          uuidv7(),
          id,
          item.id,
          item.catalogItemId,
          item.name,
          item.quantity,
          item.unitValueCp,
          Number(item.stackable),
          Number(item.magic),
          item.rarity,
          item.curseName,
          item.containerId
            ? (containerIds.get(item.containerId) ?? null)
            : null,
          position
        )
    )
    return this.require(id)
  }

  acceptGeneratedDraft(
    run: GeneratedRun,
    generated: GeneratedTreasure,
    draft: MaterializedGroupRewardTreasureDraft,
    anchor: TreasureAnchor,
    now: string
  ): Treasure {
    const existing = this.findByGenerated(run.id, generated.id)
    if (existing) return existing
    const id = uuidv7()
    this.insertTreasure({
      id,
      label: draft.label,
      anchor,
      sourceKind: 'generated',
      sourceRunId: run.id,
      sourceTreasureId: generated.id,
      now
    })
    const containerIds = new Map<string, string>()
    draft.containers.forEach((container, position) => {
      const containerId = uuidv7()
      containerIds.set(container.draftId, containerId)
      this.db
        .prepare(
          `INSERT INTO loot_container (
             id, treasure_id, catalog_container_id, name, capacity, position
           ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          containerId,
          id,
          container.catalogContainerId,
          container.name,
          container.capacity,
          position
        )
    })
    draft.items.forEach((item, position) => {
      const containerId = item.containerDraftId
        ? containerIds.get(item.containerDraftId)
        : null
      if (item.containerDraftId && !containerId)
        throw new CapabilityError('validation_failed', false)
      this.db
        .prepare(
          `INSERT INTO loot_item (
             id, treasure_id, source_line_id, catalog_item_id, name, quantity,
             unit_value_cp, stackable, magic, rarity, curse_name, container_id,
             position
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          uuidv7(),
          id,
          item.sourceLineId,
          item.catalogItemId,
          item.name,
          item.quantity,
          item.unitValueCp,
          Number(item.stackable),
          Number(item.magic),
          item.rarity,
          item.curseName,
          containerId,
          position
        )
    })
    return this.require(id)
  }

  update(input: ParsedUpdateTreasureInput, now: string): Treasure {
    const current = this.require(input.treasureId)
    if (current.revision !== input.expectedRevision)
      throw new CapabilityError('stale', true)
    const diff = buildTreasureAggregateDiff(current, input)
    const anchor = anchorColumns(input.anchor)
    this.db
      .prepare(
        `UPDATE loot_treasure
         SET revision = revision + 1, label = ?, anchor_kind = ?,
             location_id = ?, scene_id = ?, group_id = ?, last_known_label = ?,
             updated_at = ?
         WHERE id = ? AND revision = ?`
      )
      .run(
        input.label.trim(),
        anchor.kind,
        anchor.locationId,
        anchor.sceneId,
        anchor.groupId,
        anchor.lastKnownLabel,
        now,
        input.treasureId,
        input.expectedRevision
      )
    this.applyAggregateDiff(input.treasureId, diff)
    this.refreshDistributionState(input.treasureId)
    return this.require(input.treasureId)
  }

  move(input: MoveTreasureInput, now: string): Treasure {
    const current = this.require(input.treasureId)
    if (current.revision !== input.expectedRevision)
      throw new CapabilityError('stale', true)
    const anchor = anchorColumns(input.anchor)
    const result = this.db
      .prepare(
        `UPDATE loot_treasure
            SET revision = revision + 1, anchor_kind = ?, location_id = ?,
                scene_id = ?, group_id = ?, last_known_label = ?, updated_at = ?
          WHERE id = ? AND revision = ?`
      )
      .run(
        anchor.kind,
        anchor.locationId,
        anchor.sceneId,
        anchor.groupId,
        anchor.lastKnownLabel,
        now,
        input.treasureId,
        input.expectedRevision
      )
    if (result.changes !== 1) throw new CapabilityError('stale', true)
    return this.require(input.treasureId)
  }

  allocatedQuantity(itemId: string): number {
    return (
      this.db
        .prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS value
           FROM loot_allocation WHERE item_id = ?`
        )
        .get(itemId) as { value: number }
    ).value
  }

  addAllocation(input: {
    id: string
    commandId: string
    treasureId: string
    itemId: string
    characterId: string
    quantity: number
    createdAt: string
  }): void {
    this.db
      .prepare(
        `INSERT INTO loot_allocation (
           id, command_id, treasure_id, item_id, character_id, quantity,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.commandId,
        input.treasureId,
        input.itemId,
        input.characterId,
        input.quantity,
        input.createdAt
      )
  }

  completeDistribution(treasureId: string, now: string): void {
    this.refreshDistributionState(treasureId)
    this.db
      .prepare(
        `UPDATE loot_treasure
         SET revision = revision + 1, updated_at = ? WHERE id = ?`
      )
      .run(now, treasureId)
  }

  private row(id: string): TreasureRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, revision, label, anchor_kind AS anchorKind,
                  location_id AS locationId, scene_id AS sceneId,
                  group_id AS groupId, last_known_label AS lastKnownLabel,
                  source_kind AS sourceKind, source_run_id AS sourceRunId,
                  source_treasure_id AS sourceTreasureId,
                  distribution_state AS distributionState,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM loot_treasure WHERE id = ?`
        )
        .get(id) as TreasureRow | undefined) ?? null
    )
  }

  private project(row: TreasureRow): Treasure {
    const containers = this.db
      .prepare(
        `SELECT id, catalog_container_id AS catalogContainerId, name,
                capacity, position
         FROM loot_container WHERE treasure_id = ? ORDER BY position, id`
      )
      .all(row.id)
    const items = (
      this.db
        .prepare(
          `SELECT item.id, item.source_line_id AS sourceLineId,
                  item.catalog_item_id AS catalogItemId, item.name,
                  item.quantity,
                  COALESCE(SUM(allocation.quantity), 0) AS allocatedQuantity,
                  item.unit_value_cp AS unitValueCp,
                  item.stackable, item.magic, item.rarity,
                  item.curse_name AS curseName,
                  item.container_id AS containerId, item.position
           FROM loot_item item
           LEFT JOIN loot_allocation allocation ON allocation.item_id = item.id
           WHERE item.treasure_id = ?
           GROUP BY item.id
           ORDER BY item.position, item.id`
        )
        .all(row.id) as Array<{
        id: string
        sourceLineId: string | null
        catalogItemId: string | null
        name: string
        quantity: number
        allocatedQuantity: number
        unitValueCp: number
        stackable: number
        magic: number
        rarity: string | null
        curseName: string | null
        containerId: string | null
        position: number
      }>
    ).map((item) => ({
      ...item,
      stackable: Boolean(item.stackable),
      magic: Boolean(item.magic)
    }))
    const totalValueCp = items.reduce(
      (sum, item) => sum + item.quantity * item.unitValueCp,
      0
    )
    const allocatedValueCp = items.reduce(
      (sum, item) => sum + item.allocatedQuantity * item.unitValueCp,
      0
    )
    return treasureSchema.parse({
      id: row.id,
      revision: row.revision,
      label: row.label,
      anchor: anchorFromRow(row),
      source:
        row.sourceKind === 'generated'
          ? {
              kind: 'generated',
              runId: row.sourceRunId,
              generatedTreasureId: row.sourceTreasureId
            }
          : { kind: 'manual' },
      items,
      containers,
      totalValueCp,
      allocatedValueCp,
      distributionState: row.distributionState,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }

  private insertTreasure(input: {
    id: string
    label: string
    anchor: TreasureAnchor
    sourceKind: 'manual' | 'generated'
    sourceRunId: string | null
    sourceTreasureId: string | null
    now: string
  }): void {
    const anchor = anchorColumns(input.anchor)
    this.db
      .prepare(
        `INSERT INTO loot_treasure (
           id, revision, label, anchor_kind, location_id, scene_id, group_id,
           last_known_label, source_kind, source_run_id, source_treasure_id,
           created_at, updated_at
         ) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.label,
        anchor.kind,
        anchor.locationId,
        anchor.sceneId,
        anchor.groupId,
        anchor.lastKnownLabel,
        input.sourceKind,
        input.sourceRunId,
        input.sourceTreasureId,
        input.now,
        input.now
      )
  }

  private insertManualItem(
    treasureId: string,
    draft: TreasureItemDraft,
    position: number
  ): void {
    this.db
      .prepare(
        `INSERT INTO loot_item (
           id, treasure_id, source_line_id, catalog_item_id, name, quantity,
           unit_value_cp, stackable, magic, rarity, curse_name, container_id,
           position
         ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, 0, NULL, NULL, ?, ?)`
      )
      .run(
        draft.id ?? uuidv7(),
        treasureId,
        draft.name.trim(),
        draft.quantity,
        draft.unitValueCp,
        Number(draft.stackable),
        draft.containerId,
        position
      )
  }

  private applyAggregateDiff(
    treasureId: string,
    diff: TreasureAggregateDiff
  ): void {
    this.db
      .prepare(
        `UPDATE loot_container SET position = position + 1000000
          WHERE treasure_id = ?`
      )
      .run(treasureId)
    const updateContainer = this.db.prepare(
      `UPDATE loot_container
          SET catalog_container_id = ?, name = ?, capacity = ?, position = ?
        WHERE id = ? AND treasure_id = ?`
    )
    const containers = [
      ...diff.retainedContainers,
      ...diff.updatedContainers,
      ...diff.insertedContainers
    ].toSorted((left, right) => left.position - right.position)
    const insertedContainerIds = new Set(
      diff.insertedContainers.map((entry) => entry.draft.id)
    )
    for (const { draft, position } of containers)
      if (insertedContainerIds.has(draft.id))
        this.insertManualContainer(treasureId, draft, position)
      else
        updateContainer.run(
          draft.catalogContainerId,
          draft.name.trim(),
          draft.capacity,
          position,
          draft.id,
          treasureId
        )

    this.db
      .prepare(
        `UPDATE loot_item SET position = position + 1000000
          WHERE treasure_id = ?`
      )
      .run(treasureId)
    const deleteItem = this.db.prepare(
      `DELETE FROM loot_item
        WHERE id = ? AND treasure_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM loot_allocation WHERE item_id = loot_item.id
          )`
    )
    for (const itemId of diff.deleted) deleteItem.run(itemId, treasureId)
    const updateItem = this.db.prepare(
      `UPDATE loot_item
          SET name = ?, quantity = ?, unit_value_cp = ?, stackable = ?,
              container_id = ?, position = ?
        WHERE id = ? AND treasure_id = ?`
    )
    const items = [
      ...diff.retained,
      ...diff.updated,
      ...diff.inserted
    ].toSorted((left, right) => left.position - right.position)
    const insertedItems = new Set(diff.inserted.map((entry) => entry.draft))
    for (const { draft, position } of items)
      if (insertedItems.has(draft))
        this.insertManualItem(treasureId, draft, position)
      else
        updateItem.run(
          draft.name.trim(),
          draft.quantity,
          draft.unitValueCp,
          Number(draft.stackable),
          draft.containerId,
          position,
          draft.id,
          treasureId
        )
    const deleteContainer = this.db.prepare(
      `DELETE FROM loot_container WHERE id = ? AND treasure_id = ?`
    )
    for (const containerId of diff.deletedContainers)
      deleteContainer.run(containerId, treasureId)
  }

  private insertManualContainer(
    treasureId: string,
    draft: TreasureContainerDraft,
    position: number
  ): void {
    this.db
      .prepare(
        `INSERT INTO loot_container (
           id, treasure_id, catalog_container_id, name, capacity, position
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        draft.id,
        treasureId,
        draft.catalogContainerId,
        draft.name.trim(),
        draft.capacity,
        position
      )
  }

  private refreshDistributionState(treasureId: string): void {
    this.db
      .prepare(
        `UPDATE loot_treasure
            SET distribution_state = CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM loot_item item
                 WHERE item.treasure_id = loot_treasure.id
              ) THEN 'open'
              WHEN NOT EXISTS (
                SELECT 1 FROM loot_item item
                 WHERE item.treasure_id = loot_treasure.id
                   AND item.quantity > COALESCE((
                     SELECT SUM(allocation.quantity)
                       FROM loot_allocation allocation
                      WHERE allocation.item_id = item.id
                   ), 0)
              ) THEN 'complete'
              WHEN EXISTS (
                SELECT 1 FROM loot_allocation allocation
                 WHERE allocation.treasure_id = loot_treasure.id
              ) THEN 'partial'
              ELSE 'open'
            END
          WHERE id = ?`
      )
      .run(treasureId)
  }
}

function anchorColumns(anchor: TreasureAnchor) {
  if (anchor.kind === 'location')
    return {
      kind: anchor.kind,
      locationId: anchor.locationId,
      sceneId: null,
      groupId: null,
      lastKnownLabel: anchor.lastKnownLabel
    }
  if (anchor.kind === 'group')
    return {
      kind: anchor.kind,
      locationId: null,
      sceneId: anchor.sceneId,
      groupId: anchor.groupId,
      lastKnownLabel: anchor.lastKnownLabel
    }
  return {
    kind: anchor.kind,
    locationId: null,
    sceneId: null,
    groupId: null,
    lastKnownLabel: null
  }
}

function anchorFromRow(row: TreasureRow): TreasureAnchor {
  if (row.anchorKind === 'location')
    return {
      kind: 'location',
      locationId: row.locationId!,
      lastKnownLabel: row.lastKnownLabel!
    }
  if (row.anchorKind === 'group')
    return {
      kind: 'group',
      sceneId: row.sceneId!,
      groupId: row.groupId!,
      lastKnownLabel: row.lastKnownLabel!
    }
  return { kind: 'unplaced' }
}
