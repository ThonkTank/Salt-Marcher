import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { migrateLootSchema30To31 } from '../../src/core/loot/loot-schema-31-migration.js'
import { ItemDefinitionResolver } from '../../src/core/loot/item-definition-resolver.js'
import { itemReferenceSchema } from '../../src/shared/contracts/loot.js'

describe('loot schema 30 to 31 migration', () => {
  it('preserves identities and replaces copied item facts with canonical references', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    createSchema30(db)
    insertSchema30Facts(db)

    migrateLootSchema30To31(db)

    expect(columns(db, 'session_generation_item')).toEqual([
      'run_id',
      'treasure_id',
      'id',
      'position',
      'item_reference_json',
      'role',
      'quantity',
      'container_id'
    ])
    expect(columns(db, 'loot_item')).toEqual([
      'id',
      'treasure_id',
      'source_line_id',
      'item_reference_json',
      'quantity',
      'container_id',
      'position'
    ])
    expect(columns(db, 'character_loot_entry')).not.toContain('item_name')
    expect(columns(db, 'character_loot_entry')).not.toContain('unit_value_cp')

    const generatedReference = reference(
      db,
      'session_generation_item',
      'generated:item:1'
    )
    expect(reference(db, 'loot_item', 'loot:item:generated')).toEqual(
      generatedReference
    )
    expect(reference(db, 'character_loot_entry', 'ledger:generated')).toEqual(
      generatedReference
    )

    const legacyReference = reference(db, 'loot_item', 'loot:item:legacy')
    expect(legacyReference).toEqual({
      kind: 'legacy',
      definitionId: 'treasure:loot:item:legacy'
    })
    expect(reference(db, 'character_loot_entry', 'ledger:legacy')).toEqual(
      legacyReference
    )

    const definitions = new ItemDefinitionResolver(db, () => {
      throw new Error('Migration fixture must not need a catalog')
    })
    expect(definitions.resolve(generatedReference)).toMatchObject({
      name: 'Gold Coins',
      unitValueCp: 1_000,
      magic: false
    })
    expect(definitions.resolve(legacyReference)).toMatchObject({
      name: 'Handkarte',
      unitValueCp: 250,
      stackable: true
    })
    expect(
      db.prepare('SELECT count(*) FROM loot_operation_receipt').pluck().get()
    ).toBe(0)
    db.close()
  })
})

function createSchema30(db: Database.Database): void {
  db.exec(`
    CREATE TABLE session_generation_run (
      id TEXT PRIMARY KEY,
      catalog_version TEXT NOT NULL,
      catalog_content_hash TEXT NOT NULL
    );
    CREATE TABLE session_generation_treasure (
      run_id TEXT NOT NULL,
      id TEXT NOT NULL,
      PRIMARY KEY (run_id, id),
      FOREIGN KEY (run_id) REFERENCES session_generation_run(id)
    );
    CREATE TABLE session_generation_container (
      run_id TEXT NOT NULL,
      treasure_id TEXT NOT NULL,
      id TEXT NOT NULL,
      PRIMARY KEY (run_id, treasure_id, id),
      FOREIGN KEY (run_id, treasure_id)
        REFERENCES session_generation_treasure(run_id, id)
    );
    CREATE TABLE session_generation_item (
      run_id TEXT NOT NULL,
      treasure_id TEXT NOT NULL,
      id TEXT NOT NULL,
      position INTEGER NOT NULL,
      catalog_item_id TEXT,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      modifier TEXT,
      quantity INTEGER NOT NULL,
      unit_value_cp INTEGER NOT NULL,
      total_value_cp INTEGER NOT NULL,
      stackable INTEGER NOT NULL,
      magic INTEGER NOT NULL,
      rarity TEXT,
      curse_name TEXT,
      curse_effect TEXT,
      container_id TEXT,
      capacity REAL NOT NULL,
      PRIMARY KEY (run_id, treasure_id, id),
      FOREIGN KEY (run_id, treasure_id)
        REFERENCES session_generation_treasure(run_id, id),
      FOREIGN KEY (run_id, treasure_id, container_id)
        REFERENCES session_generation_container(run_id, treasure_id, id)
    );
    CREATE TABLE session_generation_audit (
      run_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      code TEXT NOT NULL,
      passed INTEGER NOT NULL,
      hard INTEGER NOT NULL,
      PRIMARY KEY (run_id, position),
      FOREIGN KEY (run_id) REFERENCES session_generation_run(id)
    );
    CREATE TABLE session_generation_audit_parameter (
      run_id TEXT NOT NULL,
      audit_position INTEGER NOT NULL,
      parameter_key TEXT NOT NULL,
      value_type TEXT NOT NULL,
      text_value TEXT,
      number_value REAL,
      boolean_value INTEGER,
      PRIMARY KEY (run_id, audit_position, parameter_key),
      FOREIGN KEY (run_id, audit_position)
        REFERENCES session_generation_audit(run_id, position)
    );
    CREATE TABLE loot_treasure (
      id TEXT PRIMARY KEY,
      source_run_id TEXT
    );
    CREATE TABLE loot_container (
      id TEXT PRIMARY KEY,
      treasure_id TEXT NOT NULL
    );
    CREATE TABLE loot_item (
      id TEXT PRIMARY KEY,
      treasure_id TEXT NOT NULL,
      source_line_id TEXT,
      catalog_entry_kind TEXT,
      catalog_item_id TEXT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_value_cp INTEGER NOT NULL,
      stackable INTEGER NOT NULL,
      magic INTEGER NOT NULL,
      rarity TEXT,
      curse_name TEXT,
      container_id TEXT,
      position INTEGER NOT NULL
    );
    CREATE TABLE character_loot_entry (
      id TEXT PRIMARY KEY,
      command_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      treasure_id TEXT,
      treasure_item_id TEXT,
      source TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_value_cp INTEGER NOT NULL,
      status TEXT NOT NULL,
      provenance_kind TEXT NOT NULL,
      provenance_treasure_label TEXT NOT NULL,
      provenance_recipient_name TEXT NOT NULL,
      source_run_id TEXT,
      generated_treasure_id TEXT,
      reward_channel TEXT,
      corrects_entry_id TEXT,
      correction_reason TEXT,
      received_at TEXT NOT NULL
    );
    CREATE TABLE loot_operation_receipt (command_id TEXT PRIMARY KEY);
  `)
}

function insertSchema30Facts(db: Database.Database): void {
  db.exec(`
    INSERT INTO session_generation_run VALUES (
      '018f47db-e17a-7000-8000-000000000001',
      'catalog-2026-07-16',
      '${'a'.repeat(64)}'
    );
    INSERT INTO session_generation_treasure VALUES (
      '018f47db-e17a-7000-8000-000000000001', 'generated:treasure:1'
    );
    INSERT INTO session_generation_item VALUES (
      '018f47db-e17a-7000-8000-000000000001', 'generated:treasure:1',
      'generated:item:1', 0, 'item:coins', 'compact_value', 'Gold Coins',
      NULL, 1, 1000, 1000, 1, 0, NULL, NULL, NULL, NULL, 2
    );
    INSERT INTO session_generation_audit VALUES (
      '018f47db-e17a-7000-8000-000000000001', 0, 'packing_validity', 1, 1
    );
    INSERT INTO session_generation_audit_parameter VALUES (
      '018f47db-e17a-7000-8000-000000000001', 0, 'count', 'number',
      NULL, 1, NULL
    );
    INSERT INTO loot_treasure VALUES (
      'loot:treasure:generated', '018f47db-e17a-7000-8000-000000000001'
    );
    INSERT INTO loot_treasure VALUES ('loot:treasure:legacy', NULL);
    INSERT INTO loot_item VALUES (
      'loot:item:generated', 'loot:treasure:generated', 'generated:item:1',
      NULL, NULL, 'Gold Coins', 1, 1000, 1, 0, NULL, NULL, NULL, 0
    );
    INSERT INTO loot_item VALUES (
      'loot:item:legacy', 'loot:treasure:legacy', NULL, NULL, NULL,
      'Handkarte', 2, 250, 1, 0, NULL, NULL, NULL, 0
    );
    INSERT INTO character_loot_entry VALUES (
      'ledger:generated', 'command:1', 'character:1',
      'loot:treasure:generated', 'loot:item:generated', 'award', 'Gold Coins',
      1, 1000, 'sold', 'treasure_distribution', 'Fund', 'Held',
      '018f47db-e17a-7000-8000-000000000001', 'generated:treasure:1',
      'encounter', NULL, NULL, '2026-08-16T10:00:00.000Z'
    );
    INSERT INTO character_loot_entry VALUES (
      'ledger:legacy', 'command:2', 'character:1',
      'loot:treasure:legacy', 'loot:item:legacy', 'award', 'Handkarte',
      2, 250, 'given_away', 'treasure_distribution', 'Fund', 'Held',
      NULL, NULL, NULL, NULL, NULL, '2026-08-16T10:01:00.000Z'
    );
    INSERT INTO loot_operation_receipt VALUES ('old-receipt');
  `)
}

function columns(db: Database.Database, table: string): readonly string[] {
  return (
    db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
  ).map((column) => column.name)
}

function reference(db: Database.Database, table: string, id: string) {
  const row = db
    .prepare(
      `SELECT item_reference_json AS itemReferenceJson FROM "${table}" WHERE id = ?`
    )
    .get(id) as { itemReferenceJson: string }
  return itemReferenceSchema.parse(JSON.parse(row.itemReferenceJson))
}
