import type Database from 'better-sqlite3'
import type { SchemaMigration } from './schema-migrations.js'
import {
  migratePartySchema28To29,
  migratePartySchema34To35
} from '../../party/party-store.js'
import {
  initializeWorldNpcSchema,
  migrateWorldNpcSchema32To33
} from '../../worldplanner/npc-store.js'
import { initializeWorldLocationSchema } from '../../worldplanner/location-store.js'
import { initializeWorldFactionSchema } from '../../worldplanner/faction-store.js'
import { migrateLootSchema30To31 } from '../../loot/loot-schema-31-migration.js'
import { initializeCampaignImportSchema } from '../../campaign-import/campaign-import-store.js'

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
    },
    {
      id: 'campaign-29-to-30-ledger-reward-basis',
      role: 'campaign',
      fromVersion: 29,
      toVersion: 30,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        database.exec(`
          CREATE TABLE session_generation_group_preset (
            run_id TEXT PRIMARY KEY NOT NULL
              REFERENCES session_generation_group_source(run_id) ON DELETE RESTRICT,
            preset_id TEXT NOT NULL,
            preset_revision INTEGER NOT NULL CHECK(preset_revision >= 0),
            preset_config_hash TEXT NOT NULL
          );
          CREATE TABLE session_generation_reward_basis (
            run_id TEXT PRIMARY KEY NOT NULL
              REFERENCES session_generation_run(id) ON DELETE RESTRICT,
            target_gold_cp INTEGER NOT NULL CHECK(target_gold_cp >= 0),
            current_gold_cp INTEGER NOT NULL CHECK(current_gold_cp >= 0),
            gold_deficit_cp INTEGER NOT NULL CHECK(gold_deficit_cp >= 0),
            target_common INTEGER NOT NULL CHECK(target_common >= 0),
            target_uncommon INTEGER NOT NULL CHECK(target_uncommon >= 0),
            target_rare INTEGER NOT NULL CHECK(target_rare >= 0),
            target_very_rare INTEGER NOT NULL CHECK(target_very_rare >= 0),
            target_legendary INTEGER NOT NULL CHECK(target_legendary >= 0),
            current_common INTEGER NOT NULL CHECK(current_common >= 0),
            current_uncommon INTEGER NOT NULL CHECK(current_uncommon >= 0),
            current_rare INTEGER NOT NULL CHECK(current_rare >= 0),
            current_very_rare INTEGER NOT NULL CHECK(current_very_rare >= 0),
            current_legendary INTEGER NOT NULL CHECK(current_legendary >= 0),
            deficit_common INTEGER NOT NULL CHECK(deficit_common >= 0),
            deficit_uncommon INTEGER NOT NULL CHECK(deficit_uncommon >= 0),
            deficit_rare INTEGER NOT NULL CHECK(deficit_rare >= 0),
            deficit_very_rare INTEGER NOT NULL CHECK(deficit_very_rare >= 0),
            deficit_legendary INTEGER NOT NULL CHECK(deficit_legendary >= 0)
          );
          CREATE TABLE session_generation_reward_member (
            run_id TEXT NOT NULL
              REFERENCES session_generation_reward_basis(run_id) ON DELETE RESTRICT,
            position INTEGER NOT NULL CHECK(position >= 0),
            character_id TEXT NOT NULL,
            current_xp INTEGER NOT NULL CHECK(current_xp >= 0),
            projected_xp INTEGER NOT NULL CHECK(projected_xp >= 0),
            ledger_revision INTEGER NOT NULL CHECK(ledger_revision >= 0),
            current_non_magic_cp INTEGER NOT NULL CHECK(current_non_magic_cp >= 0),
            magic_common INTEGER NOT NULL CHECK(magic_common >= 0),
            magic_uncommon INTEGER NOT NULL CHECK(magic_uncommon >= 0),
            magic_rare INTEGER NOT NULL CHECK(magic_rare >= 0),
            magic_very_rare INTEGER NOT NULL CHECK(magic_very_rare >= 0),
            magic_legendary INTEGER NOT NULL CHECK(magic_legendary >= 0),
            PRIMARY KEY (run_id, position),
            UNIQUE (run_id, character_id)
          );
        `)
        database
          .prepare(
            'INSERT INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'campaign-29-to-30-ledger-reward-basis',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'campaign-30-to-31-canonical-item-references',
      role: 'campaign',
      fromVersion: 30,
      toVersion: 31,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        migrateLootSchema30To31(database)
        database
          .prepare(
            'INSERT INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'campaign-30-to-31-canonical-item-references',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'campaign-31-to-32-reward-participant-levels',
      role: 'campaign',
      fromVersion: 31,
      toVersion: 32,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        database.exec(
          'ALTER TABLE session_generation_reward_member ADD COLUMN level INTEGER CHECK(level BETWEEN 1 AND 20)'
        )
        database
          .prepare(
            'INSERT INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'campaign-31-to-32-reward-participant-levels',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'campaign-32-to-33-world-planner-relations',
      role: 'campaign',
      fromVersion: 32,
      toVersion: 33,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        initializeWorldLocationSchema(database)
        initializeWorldFactionSchema(database)
        migrateWorldNpcSchema32To33(database)
        database
          .prepare(
            'INSERT INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'campaign-32-to-33-world-planner-relations',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'campaign-33-to-34-import-provenance',
      role: 'campaign',
      fromVersion: 33,
      toVersion: 34,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        initializeCampaignImportSchema(database)
        database
          .prepare(
            'INSERT INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('campaign-33-to-34-import-provenance', new Date().toISOString())
      }
    },
    {
      id: 'campaign-34-to-35-derived-party-levels',
      role: 'campaign',
      fromVersion: 34,
      toVersion: 35,
      migrate(database) {
        initializeCampaignSchemaMetadata(database)
        migratePartySchema34To35(database)
        database
          .prepare(
            'INSERT INTO campaign_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'campaign-34-to-35-derived-party-levels',
            new Date().toISOString()
          )
      }
    }
  ])
