import type Database from 'better-sqlite3'
import type { SchemaMigration } from './schema-migrations.js'

export function initializeCampaignSchemaMetadata(
  database: Database.Database
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS campaign_schema_migration (
      migration_id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)
}

export const campaignSchemaMigrations: readonly SchemaMigration[] =
  Object.freeze([
    {
      id: 'campaign-27-to-28-migration-history',
      role: 'campaign',
      fromVersion: 27,
      toVersion: 28,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        database
          .prepare(
            'INSERT OR IGNORE INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('campaign-27-to-28-migration-history', 'schema-28-bootstrap')
      }
    }
  ])
