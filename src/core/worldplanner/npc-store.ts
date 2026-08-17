import Database from 'better-sqlite3'
import { z } from 'zod'
import {
  worldNpcCommandReceiptSchema,
  worldNpcDeleteReceiptSchema,
  worldNpcDetailProjectionSchema,
  worldNpcPageSchema,
  worldNpcSearchInputSchema,
  worldNpcSchema,
  worldNpcDraftSchema,
  worldNpcMutationReceiptSchema,
  worldNpcSnapshotSchema,
  type WorldNpc,
  type WorldNpcDraft,
  type WorldNpcPage,
  type WorldNpcSearchInput,
  type WorldNpcSnapshot
} from '../../shared/contracts/world-npc.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import type { WorldFactionSnapshot } from '../../shared/contracts/encounter-source.js'
import type { NpcReferenceDependencies } from '../reference/reference-change-coordinator.js'

export const WORLD_NPC_RECEIPT_RETENTION_LIMIT = 1_000

export interface CreatureReferenceResolver {
  resolve(id: string): Readonly<{ id: string; displayName: string }> | null
}

export interface WorldNpcFactionMembershipCoordinator {
  read(): WorldFactionSnapshot
  assertMembershipRevision(expectedRevision: number): void
  recordMembershipChange(): void
}

export function initializeWorldNpcSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worldplanner_npc_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS worldplanner_npc (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      creature_id TEXT NOT NULL,
      lifecycle TEXT NOT NULL CHECK(lifecycle IN ('active', 'defeated')),
      appearance TEXT NOT NULL,
      behavior TEXT NOT NULL,
      history TEXT NOT NULL,
      notes TEXT NOT NULL,
      disposition_modifier INTEGER NOT NULL CHECK(disposition_modifier BETWEEN -50 AND 50),
      location_id TEXT REFERENCES worldplanner_location(id) ON DELETE SET NULL,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS worldplanner_faction_npc (
      npc_id TEXT PRIMARY KEY NOT NULL REFERENCES worldplanner_npc(id) ON DELETE CASCADE,
      faction_id TEXT NOT NULL REFERENCES worldplanner_faction(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_worldplanner_faction_npc_faction
      ON worldplanner_faction_npc(faction_id, npc_id);
    CREATE INDEX IF NOT EXISTS idx_worldplanner_npc_name
      ON worldplanner_npc(display_name COLLATE NOCASE, id);
    CREATE INDEX IF NOT EXISTS idx_worldplanner_npc_location
      ON worldplanner_npc(location_id, id);
    CREATE TABLE IF NOT EXISTS worldplanner_npc_command_receipt (
      command_id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      request_json TEXT NOT NULL,
      result_json TEXT NOT NULL
    );
  `)
  db.prepare(
    'INSERT OR IGNORE INTO worldplanner_npc_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export function migrateWorldNpcSchema32To33(db: Database.Database): void {
  db.exec(`
    CREATE TABLE worldplanner_npc_v33 (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      creature_id TEXT NOT NULL,
      lifecycle TEXT NOT NULL CHECK(lifecycle IN ('active', 'defeated')),
      appearance TEXT NOT NULL,
      behavior TEXT NOT NULL,
      history TEXT NOT NULL,
      notes TEXT NOT NULL,
      disposition_modifier INTEGER NOT NULL CHECK(disposition_modifier BETWEEN -50 AND 50),
      location_id TEXT REFERENCES worldplanner_location(id) ON DELETE SET NULL,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    INSERT INTO worldplanner_npc_v33
      (id, display_name, creature_id, lifecycle, appearance, behavior, history,
       notes, disposition_modifier, location_id, position)
    SELECT npc.id, npc.display_name, npc.creature_id, npc.lifecycle,
           npc.appearance, npc.behavior, npc.history, npc.notes,
           npc.disposition_modifier,
           CASE WHEN location.id IS NULL THEN NULL ELSE npc.location_id END,
           npc.position
    FROM worldplanner_npc npc
    LEFT JOIN worldplanner_location location ON location.id = npc.location_id;

    CREATE TABLE worldplanner_faction_npc_v33 (
      npc_id TEXT PRIMARY KEY NOT NULL
        REFERENCES worldplanner_npc_v33(id) ON DELETE CASCADE,
      faction_id TEXT NOT NULL
        REFERENCES worldplanner_faction(id) ON DELETE CASCADE
    );
    INSERT INTO worldplanner_faction_npc_v33 (npc_id, faction_id)
    SELECT membership.npc_id, membership.faction_id
    FROM worldplanner_faction_npc membership
    JOIN worldplanner_npc_v33 npc ON npc.id = membership.npc_id
    JOIN worldplanner_faction faction ON faction.id = membership.faction_id;

    DROP TABLE worldplanner_faction_npc;
    DROP TABLE worldplanner_npc;
    ALTER TABLE worldplanner_npc_v33 RENAME TO worldplanner_npc;
    ALTER TABLE worldplanner_faction_npc_v33 RENAME TO worldplanner_faction_npc;
    CREATE INDEX idx_worldplanner_faction_npc_faction
      ON worldplanner_faction_npc(faction_id, npc_id);
    CREATE INDEX idx_worldplanner_npc_name
      ON worldplanner_npc(display_name COLLATE NOCASE, id);
    CREATE INDEX idx_worldplanner_npc_location
      ON worldplanner_npc(location_id, id);
  `)
}

export class WorldNpcStore {
  constructor(
    private readonly db: Database.Database,
    private readonly creatures: CreatureReferenceResolver
  ) {}

  readAllForReferences(): WorldNpcSnapshot {
    const rows = this.db
      .prepare(
        `
      SELECT npc.id, npc.display_name AS displayName, npc.creature_id AS creatureId,
             npc.lifecycle, npc.appearance, npc.behavior, npc.history, npc.notes,
             npc.disposition_modifier AS dispositionModifier,
             membership.faction_id AS factionId, npc.location_id AS locationId,
             npc.position
      FROM worldplanner_npc npc
      LEFT JOIN worldplanner_faction_npc membership ON membership.npc_id = npc.id
      ORDER BY npc.position, npc.id
    `
      )
      .all()
    return worldNpcSnapshotSchema.parse({
      revision: this.revision(),
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
         LEFT JOIN worldplanner_faction_npc membership ON membership.npc_id = npc.id
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
         LEFT JOIN worldplanner_faction_npc membership ON membership.npc_id = npc.id
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
           LEFT JOIN worldplanner_faction_npc membership ON membership.npc_id = npc.id
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
                location.display_name AS locationDisplayName,
                npc.position
         FROM worldplanner_npc npc
         LEFT JOIN worldplanner_faction_npc membership ON membership.npc_id = npc.id
         LEFT JOIN worldplanner_faction faction ON faction.id = membership.faction_id
         LEFT JOIN worldplanner_location location ON location.id = npc.location_id
         ${where}
         ORDER BY npc.position, npc.id LIMIT ? OFFSET ?`
      )
      .all(...parameters, query.limit, query.offset) as Array<
      Record<string, unknown> & { creatureId: string }
    >
    return worldNpcPageSchema.parse({
      revision: this.revision(),
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
         LEFT JOIN worldplanner_faction_npc membership ON membership.npc_id = npc.id
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
      revision: this.revision(),
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

  recordExternalReferenceChange(ids: readonly string[]): void {
    if (ids.length > 0) this.bumpRevision()
  }

  currentRevision(): number {
    return this.revision()
  }

  commandReceipt(commandId: string) {
    const row = this.db
      .prepare(
        'SELECT result_json AS resultJson FROM worldplanner_npc_command_receipt WHERE command_id = ?'
      )
      .get(commandId) as { resultJson: string } | undefined
    return row
      ? worldNpcCommandReceiptSchema.parse(JSON.parse(row.resultJson))
      : null
  }

  create(
    commandId: string,
    draft: WorldNpcDraft,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    const parsed = worldNpcDraftSchema.parse(draft)
    const request = { draft: parsed, expectedRevision, expectedFactionRevision }
    const replay = this.receipt(
      commandId,
      'create',
      request,
      worldNpcMutationReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      if (parsed.factionId !== null)
        factions.assertMembershipRevision(
          requireFactionRevision(expectedFactionRevision)
        )
      this.assertReferences(parsed)
      const id = uuidv7()
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM worldplanner_npc'
          )
          .get() as { value: number }
      ).value
      this.insert(id, position, parsed)
      this.replaceFaction(id, parsed.factionId)
      this.bumpRevision()
      if (parsed.factionId !== null) factions.recordMembershipChange()
      const saved = requireNpc(this.detail(id))
      this.writeReceipt(commandId, 'create', request, {
        revision: this.revision(),
        factionRevision: factions.read().revision,
        saved
      })
    })
    return this.receipt(
      commandId,
      'create',
      request,
      worldNpcMutationReceiptSchema
    )!
  }

  update(
    commandId: string,
    id: string,
    draft: WorldNpcDraft,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    const parsed = worldNpcDraftSchema.parse(draft)
    const request = {
      id,
      draft: parsed,
      expectedRevision,
      expectedFactionRevision
    }
    const replay = this.receipt(
      commandId,
      'update',
      request,
      worldNpcMutationReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      this.assertReferences(parsed)
      const previousFactionId = this.factionId(id)
      const membershipChanged = previousFactionId !== parsed.factionId
      if (membershipChanged)
        factions.assertMembershipRevision(
          requireFactionRevision(expectedFactionRevision)
        )
      const changed = this.db
        .prepare(
          `
        UPDATE worldplanner_npc
        SET display_name = ?, creature_id = ?, lifecycle = ?, appearance = ?,
            behavior = ?, history = ?, notes = ?, disposition_modifier = ?, location_id = ?
        WHERE id = ?
      `
        )
        .run(
          parsed.displayName,
          parsed.creatureId,
          parsed.lifecycle,
          parsed.appearance,
          parsed.behavior,
          parsed.history,
          parsed.notes,
          parsed.dispositionModifier,
          parsed.locationId,
          id
        ).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
      this.replaceFaction(id, parsed.factionId)
      this.bumpRevision()
      if (membershipChanged) factions.recordMembershipChange()
      const saved = requireNpc(this.detail(id))
      this.writeReceipt(commandId, 'update', request, {
        revision: this.revision(),
        factionRevision: factions.read().revision,
        saved
      })
    })
    return this.receipt(
      commandId,
      'update',
      request,
      worldNpcMutationReceiptSchema
    )!
  }

  delete(
    commandId: string,
    id: string,
    expectedRevision: number,
    expectedFactionRevision: number | null,
    factions: WorldNpcFactionMembershipCoordinator
  ) {
    const request = { id, expectedRevision, expectedFactionRevision }
    const replay = this.receipt(
      commandId,
      'delete',
      request,
      worldNpcDeleteReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      const previousFactionId = this.factionId(id)
      if (previousFactionId !== null)
        factions.assertMembershipRevision(
          requireFactionRevision(expectedFactionRevision)
        )
      if (
        this.db.prepare('DELETE FROM worldplanner_npc WHERE id = ?').run(id)
          .changes === 0
      )
        throw new CapabilityError('not_found', false)
      this.bumpRevision()
      if (previousFactionId !== null) factions.recordMembershipChange()
      this.writeReceipt(commandId, 'delete', request, {
        revision: this.revision(),
        factionRevision: factions.read().revision,
        deletedId: id
      })
    })
    return this.receipt(
      commandId,
      'delete',
      request,
      worldNpcDeleteReceiptSchema
    )!
  }

  unlinkFaction(factionId: string): readonly string[] {
    const ids = (
      this.db
        .prepare(
          'SELECT npc_id AS id FROM worldplanner_faction_npc WHERE faction_id = ? ORDER BY npc_id'
        )
        .all(factionId) as { id: string }[]
    ).map((row) => row.id)
    if (ids.length === 0) return ids
    this.db
      .prepare('DELETE FROM worldplanner_faction_npc WHERE faction_id = ?')
      .run(factionId)
    this.bumpRevision()
    return ids
  }

  unlinkLocation(locationId: string): readonly string[] {
    const ids = (
      this.db
        .prepare(
          'SELECT id FROM worldplanner_npc WHERE location_id = ? ORDER BY id'
        )
        .all(locationId) as { id: string }[]
    ).map((row) => row.id)
    if (ids.length === 0) return ids
    this.db
      .prepare(
        'UPDATE worldplanner_npc SET location_id = NULL WHERE location_id = ?'
      )
      .run(locationId)
    this.bumpRevision()
    return ids
  }

  private insert(
    id: string,
    position: number,
    draft: z.output<typeof worldNpcDraftSchema>
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO worldplanner_npc
      (id, display_name, creature_id, lifecycle, appearance, behavior, history,
       notes, disposition_modifier, location_id, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        draft.displayName,
        draft.creatureId,
        draft.lifecycle,
        draft.appearance,
        draft.behavior,
        draft.history,
        draft.notes,
        draft.dispositionModifier,
        draft.locationId,
        position
      )
  }

  private replaceFaction(id: string, factionId: string | null): void {
    this.db
      .prepare('DELETE FROM worldplanner_faction_npc WHERE npc_id = ?')
      .run(id)
    if (factionId !== null)
      this.db
        .prepare(
          'INSERT INTO worldplanner_faction_npc (npc_id, faction_id) VALUES (?, ?)'
        )
        .run(id, factionId)
  }

  private factionId(id: string): string | null {
    const row = this.db
      .prepare(
        'SELECT faction_id AS factionId FROM worldplanner_faction_npc WHERE npc_id = ?'
      )
      .get(id) as { factionId: string } | undefined
    return row?.factionId ?? null
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

  private assertReferences(draft: z.output<typeof worldNpcDraftSchema>): void {
    if (!this.creatures.resolve(draft.creatureId))
      throw new CapabilityError('not_found', false)
    if (
      draft.factionId !== null &&
      this.db
        .prepare('SELECT 1 FROM worldplanner_faction WHERE id = ?')
        .get(draft.factionId) === undefined
    )
      throw new CapabilityError('not_found', false)
    if (
      draft.locationId !== null &&
      this.db
        .prepare('SELECT 1 FROM worldplanner_location WHERE id = ?')
        .get(draft.locationId) === undefined
    )
      throw new CapabilityError('not_found', false)
  }

  private revision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM worldplanner_npc_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
  }

  private assertRevision(expected: number): void {
    if (this.revision() !== expected) throw new CapabilityError('stale', true)
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE worldplanner_npc_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }

  private transact(work: () => void): void {
    if (this.db.inTransaction) work()
    else this.db.transaction(work)()
  }

  private writeReceipt(
    commandId: string,
    operation: 'create' | 'update' | 'delete',
    request: unknown,
    result: unknown
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO worldplanner_npc_command_receipt
      (command_id, operation, request_json, result_json) VALUES (?, ?, ?, ?)
    `
      )
      .run(
        commandId,
        operation,
        JSON.stringify(request),
        JSON.stringify(result)
      )
    this.db
      .prepare(
        `DELETE FROM worldplanner_npc_command_receipt
         WHERE command_id NOT IN (
           SELECT command_id FROM worldplanner_npc_command_receipt
           ORDER BY rowid DESC LIMIT ?
         )`
      )
      .run(WORLD_NPC_RECEIPT_RETENTION_LIMIT)
  }

  private receipt<Output>(
    commandId: string,
    operation: 'create' | 'update' | 'delete',
    request: unknown,
    schema: z.ZodType<Output>
  ): Output | null {
    const row = this.db
      .prepare(
        `
      SELECT operation, request_json AS requestJson, result_json AS resultJson
      FROM worldplanner_npc_command_receipt WHERE command_id = ?
    `
      )
      .get(commandId) as
      { operation: string; requestJson: string; resultJson: string } | undefined
    if (!row) return null
    if (
      row.operation !== operation ||
      row.requestJson !== JSON.stringify(request)
    )
      throw new CapabilityError('validation_failed', false)
    return schema.parse(JSON.parse(row.resultJson))
  }
}

function requireNpc(npc: WorldNpc | null): WorldNpc {
  if (!npc) throw new Error('Saved NPC is missing.')
  return npc
}

function requireFactionRevision(value: number | null): number {
  if (value === null) throw new CapabilityError('validation_failed', false)
  return value
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
