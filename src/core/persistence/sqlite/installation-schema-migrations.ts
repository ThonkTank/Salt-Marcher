import type Database from 'better-sqlite3'
import type { SchemaMigration } from './schema-migrations.js'

export function initializeInstallationSchemaMetadata(
  database: Database.Database
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS installation_schema_migration (
      migration_id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)
}

export const installationSchemaMigrations: readonly SchemaMigration[] =
  Object.freeze([
    {
      id: 'installation-27-to-28-migration-history',
      role: 'installation',
      fromVersion: 27,
      toVersion: 28,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        database
          .prepare(
            'INSERT OR IGNORE INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('installation-27-to-28-migration-history', 'schema-28-bootstrap')
      }
    },
    {
      id: 'installation-28-to-29-campaign-catalogs',
      role: 'installation',
      fromVersion: 28,
      toVersion: 29,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        database
          .prepare(
            'INSERT OR IGNORE INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('installation-28-to-29-campaign-catalogs', 'schema-29-bootstrap')
      }
    }
  ])
