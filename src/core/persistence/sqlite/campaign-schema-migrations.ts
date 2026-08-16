import type Database from 'better-sqlite3'
import type { SchemaMigration } from './schema-migrations.js'
import { migratePartySchema28To29 } from '../../party/party-store.js'
import { initializeWorldNpcSchema } from '../../worldplanner/npc-store.js'

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
    },
    {
      id: 'campaign-28-to-29-npcs-and-character-details',
      role: 'campaign',
      fromVersion: 28,
      toVersion: 29,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        migratePartySchema28To29(database)
        initializeWorldNpcSchema(database)
        database
          .prepare(
            'INSERT OR IGNORE INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'campaign-28-to-29-npcs-and-character-details',
            'schema-29-bootstrap'
          )
      }
    }
  ])
