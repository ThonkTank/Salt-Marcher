import Database from 'better-sqlite3'
import { expect, it } from 'vitest'
import { initializeLootOperationJournalSchema } from '../../src/core/loot/loot-operation-journal.js'
import { initializePartyHistorySchema } from '../../src/core/party/party-history-store.js'
import { migratePartySections41To42 } from '../../src/core/party/party-store.js'
import {
  applySchemaMigrations,
  schemaMigrations
} from '../../src/core/persistence/sqlite/schema-migrations.js'

// Focused migration fixtures for the two independently shipped candidate/Main
// schema-42 shapes; original AppImage evidence is maintained separately.
function seed(kind: 'main42' | 'candidate42' | 'legacy41') {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE player_characters (id TEXT PRIMARY KEY, name TEXT, xp INTEGER);
    INSERT INTO player_characters VALUES ('mara', 'Mara', 1000);`)
  if (kind === 'main42') {
    migratePartySections41To42(db)
    initializePartyHistorySchema(db)
    db.exec(`UPDATE player_characters SET rest_sections_closed = 1,
      rest_section_start_xp = 975, rest_sections_trusted = 1;
      INSERT INTO party_action_history (id, installation_id, description, applied, payload_json)
      VALUES ('history', 'installation', 'Existing change', 1, '{}');`)
  }
  if (kind === 'candidate42') {
    initializeLootOperationJournalSchema(db)
    db.exec(`INSERT INTO loot_operation_receipt VALUES
      ('receipt', 'distribute', 'fingerprint', 'mara', 1, '{"revision":7}');`)
  }
  db.pragma(`user_version = ${kind === 'legacy41' ? 41 : 42}`)
  return db
}

it.each(['main42', 'candidate42', 'legacy41'] as const)(
  'converges %s without replacing values or command history',
  (kind) => {
    const db = seed(kind)
    try {
      const before = db.prepare('SELECT * FROM player_characters').get()
      const receipts =
        kind === 'candidate42'
          ? db.prepare('SELECT * FROM loot_operation_receipt').all()
          : []
      const history =
        kind === 'main42'
          ? db.prepare('SELECT * FROM party_action_history').all()
          : []
      applySchemaMigrations(db, { path: ':memory:', role: 'campaign' })
      expect(db.pragma('user_version', { simple: true })).toBe(43)
      expect(db.prepare('SELECT * FROM player_characters').get()).toEqual({
        rest_sections_closed: 0,
        rest_section_start_xp: 0,
        rest_sections_trusted: 0,
        ...(before as object)
      })
      expect(db.prepare('SELECT * FROM loot_operation_receipt').all()).toEqual(
        receipts
      )
      expect(db.prepare('SELECT * FROM party_action_history').all()).toEqual(
        history
      )
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(db.pragma('foreign_key_check')).toEqual([])
      const applied = db
        .prepare('SELECT * FROM campaign_schema_migration')
        .all()
      applySchemaMigrations(db, { path: ':memory:', role: 'campaign' })
      expect(
        db.prepare('SELECT * FROM campaign_schema_migration').all()
      ).toEqual(applied)
    } finally {
      db.close()
    }
  }
)

it('rolls back convergence DDL and preserves the candidate receipt on failure', () => {
  const db = seed('candidate42')
  try {
    const before = db.serialize()
    const interrupted = schemaMigrations.map((m) =>
      m.id === 'campaign-42-to-43-converge-party-history-and-loot-receipts'
        ? {
            ...m,
            migrate: (...args: Parameters<typeof m.migrate>) => {
              m.migrate(...args)
              throw new Error('interrupted')
            }
          }
        : m
    )
    expect(() =>
      applySchemaMigrations(
        db,
        { path: ':memory:', role: 'campaign' },
        interrupted
      )
    ).toThrow('interrupted')
    expect(db.pragma('user_version', { simple: true })).toBe(42)
    expect(db.serialize()).toEqual(before)
  } finally {
    db.close()
  }
})
