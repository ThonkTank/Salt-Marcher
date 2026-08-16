import type Database from 'better-sqlite3'

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
      source_container_id TEXT,
      catalog_container_id TEXT,
      name TEXT NOT NULL,
      capacity REAL NOT NULL CHECK(capacity >= 0),
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(treasure_id, position),
      UNIQUE(treasure_id, source_container_id)
    );
    CREATE TABLE IF NOT EXISTS loot_item (
      id TEXT PRIMARY KEY NOT NULL,
      treasure_id TEXT NOT NULL REFERENCES loot_treasure(id) ON DELETE CASCADE,
      source_line_id TEXT,
      item_reference_json TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      container_id TEXT REFERENCES loot_container(id) ON DELETE SET NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(treasure_id, position),
      UNIQUE(treasure_id, source_line_id)
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
