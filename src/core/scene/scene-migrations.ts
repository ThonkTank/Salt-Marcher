import type Database from 'better-sqlite3'

export function migrateSceneSchemaV3ToV4(db: Database.Database): void {
  db.exec("ALTER TABLE scene_group ADD COLUMN note TEXT NOT NULL DEFAULT ''")
}
