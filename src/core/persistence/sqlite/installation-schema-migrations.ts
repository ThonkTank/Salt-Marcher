import type Database from 'better-sqlite3'
import { defaultGeneratorLootRules } from '../../../shared/generator/default-loot-rules.js'
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
    }
  ])

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
