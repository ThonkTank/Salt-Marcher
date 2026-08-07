import Database from 'better-sqlite3'
import {
  encounterTableDraftSchema,
  encounterTableSnapshotSchema,
  type EncounterTableDraft,
  type EncounterTableScope,
  type EncounterTableSnapshot
} from '../../shared/contracts/encounter-source.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'

export function initializeEncounterTableSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS encounter_table_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS encounter_table (
      id TEXT PRIMARY KEY NOT NULL,
      scope TEXT NOT NULL DEFAULT 'campaign' CHECK(scope IN ('installation', 'campaign')),
      protected INTEGER NOT NULL DEFAULT 0 CHECK(protected IN (0, 1)),
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS encounter_table_entry (
      encounter_table_id TEXT NOT NULL REFERENCES encounter_table(id) ON DELETE CASCADE,
      creature_id TEXT NOT NULL,
      weight INTEGER NOT NULL CHECK(weight BETWEEN 1 AND 10),
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (encounter_table_id, creature_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_table_loot_link (
      encounter_table_id TEXT PRIMARY KEY NOT NULL REFERENCES encounter_table(id) ON DELETE CASCADE,
      loot_table_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS encounter_table_command_receipt (
      command_id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      request_json TEXT NOT NULL,
      result_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS encounter_table_lifecycle_job (
      command_id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('update', 'delete')),
      table_id TEXT NOT NULL,
      expected_revision INTEGER NOT NULL CHECK(expected_revision >= 0),
      draft_json TEXT,
      state TEXT NOT NULL CHECK(state IN ('pending', 'completed'))
    );
    CREATE TABLE IF NOT EXISTS encounter_table_lifecycle_campaign (
      command_id TEXT NOT NULL REFERENCES encounter_table_lifecycle_job(command_id) ON DELETE CASCADE,
      campaign_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending', 'completed')),
      PRIMARY KEY (command_id, campaign_id)
    );
    CREATE INDEX IF NOT EXISTS idx_encounter_table_name
      ON encounter_table(display_name COLLATE NOCASE, id);
  `)
  db.prepare(
    'INSERT OR IGNORE INTO encounter_table_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export class EncounterTableStore {
  constructor(
    private readonly db: Database.Database,
    private readonly scope: EncounterTableScope = 'campaign'
  ) {}

  read(): EncounterTableSnapshot {
    const rows = this.db
      .prepare(
        `SELECT id, scope, protected, display_name AS displayName, description, position
         FROM encounter_table WHERE scope = ? ORDER BY position, id`
      )
      .all(this.scope) as {
      id: string
      scope: EncounterTableScope
      protected: number
      displayName: string
      description: string
      position: number
    }[]
    const entriesByTable = new Map<
      string,
      Array<{ creatureId: string; weight: number; position: number }>
    >()
    const entryRows = this.db
      .prepare(
        `SELECT entry.encounter_table_id AS tableId,
                entry.creature_id AS creatureId, entry.weight, entry.position
         FROM encounter_table_entry entry
         JOIN encounter_table owner ON owner.id = entry.encounter_table_id
         WHERE owner.scope = ?
         ORDER BY entry.encounter_table_id, entry.position, entry.creature_id`
      )
      .all(this.scope) as Array<{
      tableId: string
      creatureId: string
      weight: number
      position: number
    }>
    for (const entry of entryRows) {
      const value = {
        creatureId: entry.creatureId,
        weight: entry.weight,
        position: entry.position
      }
      if (entriesByTable.has(entry.tableId))
        entriesByTable.get(entry.tableId)!.push(value)
      else entriesByTable.set(entry.tableId, [value])
    }
    return encounterTableSnapshotSchema.parse({
      revision: this.revision(),
      installationRevision: this.scope === 'installation' ? this.revision() : 0,
      campaignRevision: this.scope === 'campaign' ? this.revision() : 0,
      tables: rows.map((row) => ({
        ...row,
        protected: Boolean(row.protected),
        entries: entriesByTable.get(row.id) ?? []
      }))
    })
  }

  contains(id: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM encounter_table WHERE id = ? AND scope = ?')
        .get(id, this.scope) !== undefined
    )
  }

  containsCreature(id: string, creatureId: string): boolean {
    return (
      this.db
        .prepare(
          'SELECT 1 FROM encounter_table_entry WHERE encounter_table_id = ? AND creature_id = ?'
        )
        .get(id, creatureId) !== undefined
    )
  }

  seedProtected(
    id: string,
    draft: EncounterTableDraft,
    position: number
  ): void {
    const parsed = encounterTableDraftSchema.parse(draft)
    if (this.contains(id)) return
    this.assertCreatures(parsed.entries.map((entry) => entry.creatureId))
    this.transact(() => {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO encounter_table
           (id, scope, protected, display_name, description, position)
           VALUES (?, ?, 1, ?, ?, ?)`
        )
        .run(id, this.scope, parsed.displayName, parsed.description, position)
      this.replaceEntries(id, parsed.entries)
    })
  }

  create(
    commandId: string,
    draft: EncounterTableDraft,
    expectedRevision: number
  ): EncounterTableSnapshot {
    const parsed = encounterTableDraftSchema.parse(draft)
    const request = { draft: parsed, expectedRevision }
    const replay = this.receipt(commandId, 'create', request)
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      this.assertCreatures(parsed.entries.map((entry) => entry.creatureId))
      const id = uuidv7()
      const position = (
        this.db
          .prepare(
            `SELECT COALESCE(MAX(position), -1) + 1 AS value
             FROM encounter_table WHERE scope = ?`
          )
          .get(this.scope) as { value: number }
      ).value
      this.db
        .prepare(
          `INSERT INTO encounter_table
           (id, scope, protected, display_name, description, position)
           VALUES (?, ?, 0, ?, ?, ?)`
        )
        .run(id, this.scope, parsed.displayName, parsed.description, position)
      this.replaceEntries(id, parsed.entries)
      this.bumpRevision()
      this.writeReceipt(commandId, 'create', request, this.read())
    })
    return this.receipt(commandId, 'create', request)!
  }

  update(
    commandId: string,
    id: string,
    draft: EncounterTableDraft,
    expectedRevision: number
  ): EncounterTableSnapshot {
    const parsed = encounterTableDraftSchema.parse(draft)
    const request = { id, draft: parsed, expectedRevision }
    const replay = this.receipt(commandId, 'update', request)
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      this.assertCreatures(parsed.entries.map((entry) => entry.creatureId))
      const changed = this.db
        .prepare(
          `UPDATE encounter_table SET display_name = ?, description = ?
           WHERE id = ? AND scope = ?`
        )
        .run(parsed.displayName, parsed.description, id, this.scope).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
      this.replaceEntries(id, parsed.entries)
      this.bumpRevision()
      this.writeReceipt(commandId, 'update', request, this.read())
    })
    return this.receipt(commandId, 'update', request)!
  }

  delete(
    commandId: string,
    id: string,
    expectedRevision: number
  ): EncounterTableSnapshot {
    const request = { id, expectedRevision }
    const replay = this.receipt(commandId, 'delete', request)
    if (replay) return replay
    this.transact(() => {
      this.assertRevision(expectedRevision)
      const row = this.db
        .prepare(
          'SELECT protected FROM encounter_table WHERE id = ? AND scope = ?'
        )
        .get(id, this.scope) as { protected: number } | undefined
      if (!row) throw new CapabilityError('not_found', false)
      if (row.protected) throw new CapabilityError('validation_failed', false)
      const changed = this.db
        .prepare('DELETE FROM encounter_table WHERE id = ? AND scope = ?')
        .run(id, this.scope).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
      this.bumpRevision()
      this.writeReceipt(commandId, 'delete', request, this.read())
    })
    return this.receipt(commandId, 'delete', request)!
  }

  beginInstallationLifecycle(input: {
    commandId: string
    operation: 'update' | 'delete'
    tableId: string
    expectedRevision: number
    draft?: EncounterTableDraft
  }): void {
    if (this.scope !== 'installation')
      throw new Error('Installation lifecycle requires the installation store')
    const draft = input.draft
      ? encounterTableDraftSchema.parse(input.draft)
      : undefined
    const existing = this.lifecycleJob(input.commandId)
    if (existing) {
      if (
        existing.operation !== input.operation ||
        existing.tableId !== input.tableId ||
        existing.expectedRevision !== input.expectedRevision ||
        existing.draftJson !== JSON.stringify(draft ?? null)
      )
        throw new CapabilityError('validation_failed', false)
      return
    }
    this.db
      .prepare(
        `INSERT INTO encounter_table_lifecycle_job
         (command_id, operation, table_id, expected_revision, draft_json, state)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(
        input.commandId,
        input.operation,
        input.tableId,
        input.expectedRevision,
        JSON.stringify(draft ?? null)
      )
  }

  pendingInstallationLifecycles(): readonly {
    commandId: string
    operation: 'update' | 'delete'
    tableId: string
    expectedRevision: number
    draft: EncounterTableDraft | null
  }[] {
    if (this.scope !== 'installation') return []
    const rows = this.db
      .prepare(
        `SELECT command_id AS commandId, operation, table_id AS tableId,
                expected_revision AS expectedRevision, draft_json AS draftJson
         FROM encounter_table_lifecycle_job
         WHERE state = 'pending' ORDER BY rowid`
      )
      .all() as Array<{
      commandId: string
      operation: 'update' | 'delete'
      tableId: string
      expectedRevision: number
      draftJson: string
    }>
    return rows.map((row) => ({
      ...row,
      draft:
        JSON.parse(row.draftJson) === null
          ? null
          : encounterTableDraftSchema.parse(JSON.parse(row.draftJson))
    }))
  }

  lifecycleCompleted(commandId: string): boolean {
    return this.lifecycleJob(commandId)?.state === 'completed'
  }

  campaignLifecycleCompleted(commandId: string, campaignId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT state FROM encounter_table_lifecycle_campaign
         WHERE command_id = ? AND campaign_id = ?`
      )
      .get(commandId, campaignId) as { state: string } | undefined
    return row?.state === 'completed'
  }

  beginCampaignLifecycle(commandId: string, campaignId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO encounter_table_lifecycle_campaign
         (command_id, campaign_id, state) VALUES (?, ?, 'pending')`
      )
      .run(commandId, campaignId)
  }

  completeCampaignLifecycle(commandId: string, campaignId: string): void {
    this.db
      .prepare(
        `UPDATE encounter_table_lifecycle_campaign SET state = 'completed'
         WHERE command_id = ? AND campaign_id = ?`
      )
      .run(commandId, campaignId)
  }

  completeInstallationLifecycle(commandId: string): void {
    this.db
      .prepare(
        `UPDATE encounter_table_lifecycle_job SET state = 'completed'
         WHERE command_id = ?`
      )
      .run(commandId)
  }

  private replaceEntries(
    id: string,
    entries: readonly { creatureId: string; weight: number }[]
  ): void {
    this.db
      .prepare('DELETE FROM encounter_table_entry WHERE encounter_table_id = ?')
      .run(id)
    const insert = this.db.prepare(
      'INSERT INTO encounter_table_entry (encounter_table_id, creature_id, weight, position) VALUES (?, ?, ?, ?)'
    )
    entries.forEach((entry, position) =>
      insert.run(id, entry.creatureId, entry.weight, position)
    )
  }

  private assertCreatures(ids: readonly string[]): void {
    if (ids.some((id) => !creatureById(id)))
      throw new CapabilityError('not_found', false)
  }

  revision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM encounter_table_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
  }

  private assertRevision(expectedRevision: number): void {
    if (this.revision() !== expectedRevision)
      throw new CapabilityError('stale', true)
  }

  private transact(operation: () => void): void {
    if (this.db.inTransaction) operation()
    else this.db.transaction(operation)()
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE encounter_table_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }

  private writeReceipt(
    commandId: string,
    operation: 'create' | 'update' | 'delete',
    request: unknown,
    result: EncounterTableSnapshot
  ): void {
    this.db
      .prepare(
        `INSERT INTO encounter_table_command_receipt
         (command_id, operation, request_json, result_json) VALUES (?, ?, ?, ?)`
      )
      .run(
        commandId,
        operation,
        JSON.stringify(request),
        JSON.stringify(encounterTableSnapshotSchema.parse(result))
      )
  }

  private receipt(
    commandId: string,
    operation: 'create' | 'update' | 'delete',
    request: unknown
  ): EncounterTableSnapshot | null {
    const row = this.db
      .prepare(
        `SELECT operation, request_json AS requestJson, result_json AS resultJson
         FROM encounter_table_command_receipt WHERE command_id = ?`
      )
      .get(commandId) as
      { operation: string; requestJson: string; resultJson: string } | undefined
    if (!row) return null
    if (
      row.operation !== operation ||
      row.requestJson !== JSON.stringify(request)
    )
      throw new CapabilityError('validation_failed', false)
    return encounterTableSnapshotSchema.parse(JSON.parse(row.resultJson))
  }

  private lifecycleJob(commandId: string):
    | {
        operation: 'update' | 'delete'
        tableId: string
        expectedRevision: number
        draftJson: string
        state: 'pending' | 'completed'
      }
    | undefined {
    return this.db
      .prepare(
        `SELECT operation, table_id AS tableId,
                expected_revision AS expectedRevision,
                draft_json AS draftJson, state
         FROM encounter_table_lifecycle_job WHERE command_id = ?`
      )
      .get(commandId) as
      | {
          operation: 'update' | 'delete'
          tableId: string
          expectedRevision: number
          draftJson: string
          state: 'pending' | 'completed'
        }
      | undefined
  }
}
