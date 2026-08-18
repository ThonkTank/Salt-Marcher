import type Database from 'better-sqlite3'
import {
  worldNpcDetailProjectionSchema,
  worldNpcPageSchema,
  worldNpcSearchInputSchema,
  worldNpcSchema,
  worldNpcSnapshotSchema,
  type WorldNpc,
  type WorldNpcPage,
  type WorldNpcSearchInput,
  type WorldNpcSnapshot
} from '../../shared/contracts/world-npc.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { NpcReferenceDependencies } from '../reference/reference-change-coordinator.js'
import type { CreatureReferenceResolver } from './world-npc-persistence.js'

/** Read-only NPC projections. This owner contains no write SQL. */
export class WorldNpcQueryRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly creatures: CreatureReferenceResolver
  ) {}

  readAllForReferences(): WorldNpcSnapshot {
    const rows = this.db
      .prepare(
        `SELECT npc.id, npc.display_name AS displayName,
                npc.creature_id AS creatureId, npc.lifecycle, npc.appearance,
                npc.behavior, npc.history, npc.notes,
                npc.disposition_modifier AS dispositionModifier,
                membership.faction_id AS factionId,
                npc.location_id AS locationId, npc.position
           FROM worldplanner_npc npc
           LEFT JOIN worldplanner_faction_npc membership
             ON membership.npc_id = npc.id
          ORDER BY npc.position, npc.id`
      )
      .all()
    return worldNpcSnapshotSchema.parse({
      revision: this.currentRevision(),
      npcs: rows
    })
  }

  referenceDependencies(): readonly NpcReferenceDependencies[] {
    return this.db
      .prepare(
        `SELECT npc.id AS npcId, npc.creature_id AS creatureId,
                membership.faction_id AS factionId,
                npc.location_id AS locationId
           FROM worldplanner_npc npc
           LEFT JOIN worldplanner_faction_npc membership
             ON membership.npc_id = npc.id
          ORDER BY npc.id`
      )
      .all() as NpcReferenceDependencies[]
  }

  referenceDependency(id: string): NpcReferenceDependencies | null {
    const row = this.db
      .prepare(
        `SELECT npc.id AS npcId, npc.creature_id AS creatureId,
                membership.faction_id AS factionId,
                npc.location_id AS locationId
           FROM worldplanner_npc npc
           LEFT JOIN worldplanner_faction_npc membership
             ON membership.npc_id = npc.id
          WHERE npc.id = ?`
      )
      .get(id) as NpcReferenceDependencies | undefined
    return row ?? null
  }

  search(input: WorldNpcSearchInput): WorldNpcPage {
    const query = worldNpcSearchInputSchema.parse(input)
    const clauses: string[] = []
    const parameters: unknown[] = []
    if (query.query !== '') {
      clauses.push(`(
        npc.display_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        npc.appearance LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        npc.behavior LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        npc.history LIKE ? ESCAPE '\\' COLLATE NOCASE OR
        npc.notes LIKE ? ESCAPE '\\' COLLATE NOCASE
      )`)
      const value = `%${escapeLike(query.query)}%`
      parameters.push(value, value, value, value, value)
    }
    if (query.lifecycle !== null) {
      clauses.push('npc.lifecycle = ?')
      parameters.push(query.lifecycle)
    }
    if (query.creatureId !== null) {
      clauses.push('npc.creature_id = ?')
      parameters.push(query.creatureId)
    }
    addNullableFilter(
      clauses,
      parameters,
      'membership.faction_id',
      query.factionId
    )
    addNullableFilter(clauses, parameters, 'npc.location_id', query.locationId)
    const where = clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS total
             FROM worldplanner_npc npc
             LEFT JOIN worldplanner_faction_npc membership
               ON membership.npc_id = npc.id
             ${where}`
        )
        .get(...parameters) as { total: number }
    ).total
    const rows = this.db
      .prepare(
        `SELECT npc.id, npc.display_name AS displayName,
                npc.creature_id AS creatureId, npc.lifecycle,
                npc.disposition_modifier AS dispositionModifier,
                membership.faction_id AS factionId,
                faction.display_name AS factionDisplayName,
                npc.location_id AS locationId,
                location.display_name AS locationDisplayName, npc.position
           FROM worldplanner_npc npc
           LEFT JOIN worldplanner_faction_npc membership
             ON membership.npc_id = npc.id
           LEFT JOIN worldplanner_faction faction
             ON faction.id = membership.faction_id
           LEFT JOIN worldplanner_location location
             ON location.id = npc.location_id
           ${where}
          ORDER BY npc.position, npc.id LIMIT ? OFFSET ?`
      )
      .all(...parameters, query.limit, query.offset) as Array<
      Record<string, unknown> & { creatureId: string }
    >
    return worldNpcPageSchema.parse({
      revision: this.currentRevision(),
      rows: rows.map((row) => ({
        ...row,
        creatureDisplayName:
          this.creatures.resolve(row.creatureId)?.displayName ?? row.creatureId
      })),
      total,
      offset: query.offset,
      limit: query.limit
    })
  }

  detail(id: string): WorldNpc | null {
    const row = this.db
      .prepare(
        `SELECT npc.id, npc.display_name AS displayName,
                npc.creature_id AS creatureId, npc.lifecycle,
                npc.appearance, npc.behavior, npc.history, npc.notes,
                npc.disposition_modifier AS dispositionModifier,
                membership.faction_id AS factionId,
                npc.location_id AS locationId, npc.position
           FROM worldplanner_npc npc
           LEFT JOIN worldplanner_faction_npc membership
             ON membership.npc_id = npc.id
          WHERE npc.id = ?`
      )
      .get(id)
    return row ? worldNpcSchema.parse(row) : null
  }

  detailProjection(id: string) {
    const npc = this.detail(id)
    if (!npc) throw new CapabilityError('not_found', false)
    const creature = this.creatures.resolve(npc.creatureId)
    if (!creature) throw new CapabilityError('not_found', false)
    return worldNpcDetailProjectionSchema.parse({
      revision: this.currentRevision(),
      npc,
      creatureDisplayName: creature.displayName,
      factionDisplayName: npc.factionId
        ? this.referenceDisplayName('worldplanner_faction', npc.factionId)
        : null,
      locationDisplayName: npc.locationId
        ? this.referenceDisplayName('worldplanner_location', npc.locationId)
        : null
    })
  }

  linkedToFaction(factionId: string): readonly string[] {
    return (
      this.db
        .prepare(
          'SELECT npc_id AS id FROM worldplanner_faction_npc WHERE faction_id = ? ORDER BY npc_id'
        )
        .all(factionId) as Array<{ id: string }>
    ).map((row) => row.id)
  }

  currentRevision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM worldplanner_npc_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
  }

  private referenceDisplayName(
    table: 'worldplanner_faction' | 'worldplanner_location',
    id: string
  ): string | null {
    const row = this.db
      .prepare(`SELECT display_name AS displayName FROM ${table} WHERE id = ?`)
      .get(id) as { displayName: string } | undefined
    return row?.displayName ?? null
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function addNullableFilter(
  clauses: string[],
  parameters: unknown[],
  column: string,
  value: string | null | undefined
): void {
  if (value === undefined) return
  if (value === null) clauses.push(`${column} IS NULL`)
  else {
    clauses.push(`${column} = ?`)
    parameters.push(value)
  }
}
