import Database from 'better-sqlite3'
import { z } from 'zod'
import {
  worldNpcCommandReceiptSchema,
  worldNpcDeleteReceiptSchema,
  worldNpcDraftSchema,
  worldNpcMutationReceiptSchema,
  worldNpcSnapshotSchema,
  type WorldNpc,
  type WorldNpcDraft,
  type WorldNpcSnapshot
} from '../../shared/contracts/world-npc.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'

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
      location_id TEXT,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS worldplanner_faction_npc (
      npc_id TEXT PRIMARY KEY NOT NULL REFERENCES worldplanner_npc(id) ON DELETE CASCADE,
      faction_id TEXT NOT NULL
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

export class WorldNpcStore {
  constructor(private readonly db: Database.Database) {}

  read(): WorldNpcSnapshot {
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

  create(commandId: string, draft: WorldNpcDraft, expectedRevision: number) {
    const parsed = worldNpcDraftSchema.parse(draft)
    const request = { draft: parsed, expectedRevision }
    const replay = this.receipt(
      commandId,
      'create',
      request,
      worldNpcMutationReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
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
      const snapshot = this.read()
      this.writeReceipt(commandId, 'create', request, {
        snapshot,
        saved: requireNpc(snapshot.npcs, id)
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
    expectedRevision: number
  ) {
    const parsed = worldNpcDraftSchema.parse(draft)
    const request = { id, draft: parsed, expectedRevision }
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
      const snapshot = this.read()
      this.writeReceipt(commandId, 'update', request, {
        snapshot,
        saved: requireNpc(snapshot.npcs, id)
      })
    })
    return this.receipt(
      commandId,
      'update',
      request,
      worldNpcMutationReceiptSchema
    )!
  }

  delete(commandId: string, id: string, expectedRevision: number) {
    const request = { id, expectedRevision }
    const replay = this.receipt(
      commandId,
      'delete',
      request,
      worldNpcDeleteReceiptSchema
    )
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      if (
        this.db.prepare('DELETE FROM worldplanner_npc WHERE id = ?').run(id)
          .changes === 0
      )
        throw new CapabilityError('not_found', false)
      this.bumpRevision()
      this.writeReceipt(commandId, 'delete', request, {
        snapshot: this.read(),
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

  private assertReferences(draft: z.output<typeof worldNpcDraftSchema>): void {
    if (!creatureById(draft.creatureId))
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

function requireNpc(npcs: readonly WorldNpc[], id: string): WorldNpc {
  const npc = npcs.find((candidate) => candidate.id === id)
  if (!npc) throw new Error('Saved NPC is missing.')
  return npc
}
