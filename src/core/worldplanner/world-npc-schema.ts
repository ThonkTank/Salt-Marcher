import type Database from 'better-sqlite3'

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
