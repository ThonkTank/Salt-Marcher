import type Database from 'better-sqlite3'
import {
  lootInboxPageSchema,
  lootSceneProjectionSchema,
  treasureSchema,
  type LootInboxInput,
  type LootInboxPage,
  type LootSceneProjection,
  type Treasure
} from '../../shared/contracts/loot.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

type AnchorRow = Readonly<{
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

export type LootReferenceFacts = Readonly<{
  locationIds: ReadonlySet<string>
  sceneGroups: ReadonlyMap<string, ReadonlySet<string>>
}>

/** Projection-owned SQL. Roots, items, and containers are loaded in three
 * bounded queries; Inbox diagnostics hydrate only the selected page. */
export class LootProjectionStore {
  constructor(private readonly db: Database.Database) {}

  scene(
    sceneId: string,
    locationId: string | null,
    groupIds: readonly string[]
  ): LootSceneProjection {
    const roots = this.db
      .prepare(
        `${rootSelect}
          WHERE (anchor_kind = 'location' AND location_id = ?)
             OR (anchor_kind = 'group' AND scene_id = ?
                 AND group_id IN (SELECT value FROM json_each(?)))
          ORDER BY updated_at, id`
      )
      .all(locationId, sceneId, JSON.stringify(groupIds)) as AnchorRow[]
    const treasures = this.hydrate(roots)
    return deepFreeze(
      lootSceneProjectionSchema.parse({
        revision: this.revision(),
        sceneId,
        locationId,
        locationTreasures: treasures.filter(
          (treasure) => treasure.anchor.kind === 'location'
        ),
        groupTreasures: groupIds.map((groupId) => ({
          groupId,
          treasures: treasures.filter(
            (treasure) =>
              treasure.anchor.kind === 'group' &&
              treasure.anchor.groupId === groupId
          )
        }))
      })
    )
  }

  inbox(input: LootInboxInput, references: LootReferenceFacts): LootInboxPage {
    const anchors = this.db
      .prepare(
        `${rootSelect}
          ORDER BY updated_at DESC, id DESC`
      )
      .all() as AnchorRow[]
    const diagnosed = anchors.flatMap((row) => {
      const reason = diagnose(row, references)
      return reason ? [{ row, reason }] : []
    })
    const afterCursor = input.cursor
      ? diagnosed.filter(({ row }) => isAfterCursor(row, input.cursor!))
      : diagnosed
    const window = afterCursor.slice(0, input.limit + 1)
    const selected = window.slice(0, input.limit)
    const hydrated = new Map(
      this.hydrate(selected.map(({ row }) => row)).map((treasure) => [
        treasure.id,
        treasure
      ])
    )
    return deepFreeze(
      lootInboxPageSchema.parse({
        revision: this.revision(),
        entries: selected.map(({ row, reason }) => ({
          treasure: hydrated.get(row.id)!,
          reason,
          lastKnownLabel: row.lastKnownLabel
        })),
        nextCursor:
          window.length > input.limit ? cursor(selected.at(-1)!.row) : null
      })
    )
  }

  revision(): number {
    return (
      this.db
        .prepare(`SELECT revision FROM loot_metadata WHERE singleton = 1`)
        .get() as { revision: number }
    ).revision
  }

  bumpRevision(): void {
    this.db
      .prepare(
        `UPDATE loot_metadata
            SET revision = revision + 1 WHERE singleton = 1`
      )
      .run()
  }

  private hydrate(roots: readonly AnchorRow[]): readonly Treasure[] {
    if (roots.length === 0) return []
    const ids = JSON.stringify(roots.map((row) => row.id))
    const containers = this.db
      .prepare(
        `SELECT treasure_id AS treasureId, id,
                catalog_container_id AS catalogContainerId, name, capacity,
                position
           FROM loot_container
          WHERE treasure_id IN (SELECT value FROM json_each(?))
          ORDER BY treasure_id, position, id`
      )
      .all(ids) as Array<Record<string, unknown> & { treasureId: string }>
    const items = (
      this.db
        .prepare(
          `SELECT item.treasure_id AS treasureId, item.id,
                  item.source_line_id AS sourceLineId,
                  item.catalog_item_id AS catalogItemId, item.name,
                  item.quantity,
                  COALESCE(SUM(allocation.quantity), 0) AS allocatedQuantity,
                  item.unit_value_cp AS unitValueCp, item.stackable, item.magic,
                  item.rarity, item.curse_name AS curseName,
                  item.container_id AS containerId, item.position
             FROM loot_item item
             LEFT JOIN loot_allocation allocation ON allocation.item_id = item.id
            WHERE item.treasure_id IN (SELECT value FROM json_each(?))
            GROUP BY item.id
            ORDER BY item.treasure_id, item.position, item.id`
        )
        .all(ids) as Array<
        Record<string, unknown> & {
          treasureId: string
          quantity: number
          allocatedQuantity: number
          unitValueCp: number
          stackable: number
          magic: number
        }
      >
    ).map((item) => ({
      ...item,
      stackable: Boolean(item.stackable),
      magic: Boolean(item.magic)
    }))
    return roots.map((row) => {
      const treasureItems = items.filter((item) => item.treasureId === row.id)
      return treasureSchema.parse({
        id: row.id,
        revision: row.revision,
        label: row.label,
        anchor: anchor(row),
        source:
          row.sourceKind === 'generated'
            ? {
                kind: 'generated',
                runId: row.sourceRunId,
                generatedTreasureId: row.sourceTreasureId
              }
            : { kind: 'manual' },
        items: treasureItems.map(({ treasureId, ...item }) => {
          void treasureId
          return item
        }),
        containers: containers
          .filter((container) => container.treasureId === row.id)
          .map(({ treasureId, ...container }) => {
            void treasureId
            return container
          }),
        totalValueCp: treasureItems.reduce(
          (sum, item) => sum + item.quantity * item.unitValueCp,
          0
        ),
        allocatedValueCp: treasureItems.reduce(
          (sum, item) => sum + item.allocatedQuantity * item.unitValueCp,
          0
        ),
        distributionState: row.distributionState,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      })
    })
  }
}

function diagnose(
  row: AnchorRow,
  references: LootReferenceFacts
): LootInboxPage['entries'][number]['reason'] | null {
  if (row.anchorKind === 'unplaced') return 'unplaced'
  if (row.anchorKind === 'location')
    return row.locationId && references.locationIds.has(row.locationId)
      ? null
      : 'missing_location'
  const groups = row.sceneId
    ? references.sceneGroups.get(row.sceneId)
    : undefined
  if (!groups) return 'missing_scene'
  return row.groupId && groups.has(row.groupId) ? null : 'missing_group'
}

function cursor(row: AnchorRow): string {
  return `${row.updatedAt}|${row.id}`
}

function isAfterCursor(row: AnchorRow, value: string): boolean {
  const separator = value.lastIndexOf('|')
  if (separator < 1 || separator === value.length - 1)
    throw new CapabilityError('validation_failed', false)
  const updatedAt = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (Number.isNaN(Date.parse(updatedAt)))
    throw new CapabilityError('validation_failed', false)
  return (
    row.updatedAt < updatedAt || (row.updatedAt === updatedAt && row.id < id)
  )
}

function anchor(row: AnchorRow) {
  if (row.anchorKind === 'location')
    return {
      kind: 'location' as const,
      locationId: row.locationId!,
      lastKnownLabel: row.lastKnownLabel!
    }
  if (row.anchorKind === 'group')
    return {
      kind: 'group' as const,
      sceneId: row.sceneId!,
      groupId: row.groupId!,
      lastKnownLabel: row.lastKnownLabel!
    }
  return { kind: 'unplaced' as const }
}

const rootSelect = `
  SELECT id, revision, label, anchor_kind AS anchorKind,
         location_id AS locationId, scene_id AS sceneId,
         group_id AS groupId, last_known_label AS lastKnownLabel,
         source_kind AS sourceKind, source_run_id AS sourceRunId,
         source_treasure_id AS sourceTreasureId,
         distribution_state AS distributionState,
         created_at AS createdAt, updated_at AS updatedAt
    FROM loot_treasure`

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
