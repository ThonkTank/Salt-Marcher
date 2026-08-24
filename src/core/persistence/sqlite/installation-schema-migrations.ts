import type Database from 'better-sqlite3'
import { migrateSessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import {
  installationPreferencesSchema,
  persistedInstallationPreferences
} from '../../../shared/contracts/settings.js'
import { defaultGeneratorLootRules } from '../../../shared/generator/default-loot-rules.js'
import type { SchemaMigration } from './schema-migrations.js'
import {
  initializeCampaignImportRegistrySchema,
  initializeCampaignImportSagaSchema
} from '../../campaign-import/campaign-import-store.js'
import {
  initializeCampaignCommandReceiptSchema,
  initializeCampaignRegistryRevision
} from './campaign-registry-repository.js'

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
    },
    {
      id: 'installation-29-to-30-generator-loot-rules',
      role: 'installation',
      fromVersion: 29,
      toVersion: 30,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        const hasPresets = Boolean(
          database
            .prepare(
              `SELECT 1 FROM sqlite_master
                WHERE type = 'table' AND name = 'generator_presets'`
            )
            .get()
        )
        const rows = hasPresets
          ? (database
              .prepare(
                'SELECT id, config_json AS configJson FROM generator_presets'
              )
              .all() as Array<{ id: string; configJson: string }>)
          : []
        const update = hasPresets
          ? database.prepare(
              `UPDATE generator_presets
                 SET schema_version = 4, config_json = ?, updated_at = ?
               WHERE id = ?`
            )
          : null
        const appliedAt = new Date().toISOString()
        for (const row of rows) {
          const config = JSON.parse(row.configJson) as Record<string, unknown>
          update!.run(
            JSON.stringify({ ...config, loot: defaultGeneratorLootRules }),
            appliedAt,
            row.id
          )
        }
        if (rows.length > 0)
          database
            .prepare(
              `UPDATE generator_preset_registry
                  SET revision = revision + 1 WHERE singleton = 1`
            )
            .run()
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('installation-29-to-30-generator-loot-rules', appliedAt)
      }
    },
    {
      id: 'installation-30-to-31-loot-contracts',
      role: 'installation',
      fromVersion: 30,
      toVersion: 31,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        const hasPresets = Boolean(
          database
            .prepare(
              `SELECT 1 FROM sqlite_master
                WHERE type = 'table' AND name = 'generator_presets'`
            )
            .get()
        )
        if (hasPresets) {
          const rows = database
            .prepare(
              'SELECT id, config_json AS configJson FROM generator_presets'
            )
            .all() as Array<{ id: string; configJson: string }>
          const update = database.prepare(
            'UPDATE generator_presets SET config_json = ?, updated_at = ? WHERE id = ?'
          )
          const appliedAt = new Date().toISOString()
          for (const row of rows) {
            const config = JSON.parse(row.configJson) as {
              loot?: { balance?: Record<string, unknown> }
            }
            if (config.loot?.balance?.['minimumRoleWeight'] === undefined)
              update.run(
                JSON.stringify({
                  ...config,
                  loot: {
                    ...config.loot,
                    balance: {
                      ...config.loot?.balance,
                      minimumRoleWeight:
                        defaultGeneratorLootRules.balance.minimumRoleWeight
                    }
                  }
                }),
                appliedAt,
                row.id
              )
          }
        }
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('installation-30-to-31-loot-contracts', new Date().toISOString())
      }
    },
    {
      id: 'installation-31-to-32-generator-config-v5',
      role: 'installation',
      fromVersion: 31,
      toVersion: 32,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        const hasPresets = Boolean(
          database
            .prepare(
              `SELECT 1 FROM sqlite_master
                WHERE type = 'table' AND name = 'generator_presets'`
            )
            .get()
        )
        const appliedAt = new Date().toISOString()
        if (hasPresets) {
          const rows = database
            .prepare(
              'SELECT id, config_json AS configJson FROM generator_presets'
            )
            .all() as Array<{ id: string; configJson: string }>
          const update = database.prepare(
            `UPDATE generator_presets
                SET schema_version = 5, config_json = ?, updated_at = ?
              WHERE id = ?`
          )
          for (const row of rows)
            update.run(
              JSON.stringify(
                upcastGeneratorConfigV5(JSON.parse(row.configJson))
              ),
              appliedAt,
              row.id
            )
        }
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('installation-31-to-32-generator-config-v5', appliedAt)
      }
    },
    {
      id: 'installation-32-to-33-role-alignment',
      role: 'installation',
      fromVersion: 32,
      toVersion: 33,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('installation-32-to-33-role-alignment', new Date().toISOString())
      }
    },
    {
      id: 'installation-33-to-34-import-registry',
      role: 'installation',
      fromVersion: 33,
      toVersion: 34,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        initializeCampaignImportRegistrySchema(database)
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'installation-33-to-34-import-registry',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'installation-34-to-35-import-saga',
      role: 'installation',
      fromVersion: 34,
      toVersion: 35,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        initializeCampaignImportSagaSchema(database)
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run('installation-34-to-35-import-saga', new Date().toISOString())
      }
    },
    {
      id: 'installation-35-to-36-session-layout-v2',
      role: 'installation',
      fromVersion: 35,
      toVersion: 36,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        migrateStoredSessionLayout(database)
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'installation-35-to-36-session-layout-v2',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'installation-36-to-37-preferences-envelope-v1',
      role: 'installation',
      fromVersion: 36,
      toVersion: 37,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        wrapStoredInstallationPreferences(database)
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'installation-36-to-37-preferences-envelope-v1',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'installation-37-to-38-campaign-registry-revision',
      role: 'installation',
      fromVersion: 37,
      toVersion: 38,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        initializeCampaignRegistryRevision(database)
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'installation-37-to-38-campaign-registry-revision',
            new Date().toISOString()
          )
      }
    },
    {
      id: 'installation-38-to-39-campaign-command-receipts',
      role: 'installation',
      fromVersion: 38,
      toVersion: 39,
      migrate(database) {
        initializeInstallationSchemaMetadata(database)
        initializeCampaignCommandReceiptSchema(database)
        database
          .prepare(
            'INSERT INTO installation_schema_migration (migration_id, applied_at) VALUES (?, ?)'
          )
          .run(
            'installation-38-to-39-campaign-command-receipts',
            new Date().toISOString()
          )
      }
    }
  ])

function wrapStoredInstallationPreferences(database: Database.Database): void {
  const hasSettings = Boolean(
    database
      .prepare(
        `SELECT 1 FROM sqlite_master
          WHERE type = 'table' AND name = 'installation_settings'`
      )
      .get()
  )
  if (!hasSettings) return
  const row = database
    .prepare(
      'SELECT preferences_json AS preferencesJson FROM installation_settings WHERE singleton = 1'
    )
    .get() as { preferencesJson: string } | undefined
  if (!row) return
  const preferences = installationPreferencesSchema.parse(
    JSON.parse(row.preferencesJson) as unknown
  )
  database
    .prepare(
      'UPDATE installation_settings SET preferences_json = ? WHERE singleton = 1'
    )
    .run(JSON.stringify(persistedInstallationPreferences(preferences)))
}

function migrateStoredSessionLayout(database: Database.Database): void {
  const hasSettings = Boolean(
    database
      .prepare(
        `SELECT 1 FROM sqlite_master
          WHERE type = 'table' AND name = 'installation_settings'`
      )
      .get()
  )
  if (!hasSettings) return
  const row = database
    .prepare(
      'SELECT preferences_json AS preferencesJson FROM installation_settings WHERE singleton = 1'
    )
    .get() as { preferencesJson: string } | undefined
  if (!row) return
  const stored = JSON.parse(row.preferencesJson) as unknown
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored))
    throw new Error('Invalid stored installation preferences')
  const preferences = stored as Record<string, unknown>
  const layout = migrateSessionLayoutPreference(preferences['sessionLayout'])
  if (layout.kind === 'invalid')
    throw new Error('Invalid stored Session layout preference')
  installationPreferencesSchema.parse(preferences)
  if (layout.kind === 'current') return
  const migrated = installationPreferencesSchema.parse({
    ...preferences,
    sessionLayout: layout.preference
  })
  database
    .prepare(
      'UPDATE installation_settings SET revision = revision + 1, preferences_json = ? WHERE singleton = 1'
    )
    .run(JSON.stringify(migrated))
}

function upcastGeneratorConfigV5(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const config = structuredClone(value) as Record<string, unknown>
  const loot = config['loot'] as Record<string, unknown> | undefined
  const coins = loot?.['coins'] as Record<string, unknown> | undefined
  const profiles = coins?.['profiles'] as Record<string, unknown> | undefined
  if (!profiles) return config
  for (const profile of Object.values(profiles)) {
    if (!profile || typeof profile !== 'object') continue
    const record = profile as Record<string, unknown>
    const legacy = record['allowedContainers']
    if (Array.isArray(legacy))
      record['allowedContainerIds'] = legacy.map(
        (name) =>
          `container:${String(name)
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/g, '-')}`
      )
    delete record['allowedContainers']
  }
  return config
}
