import type Database from 'better-sqlite3'
import {
  databaseSchemaVersions,
  IncompatibleDataError,
  type DatabaseRole
} from './database.js'
import { installationSchemaMigrations } from './installation-schema-migrations.js'
import { campaignSchemaMigrations } from './campaign-schema-migrations.js'

export const migrationRegistryVersion = 1

export type SchemaMigrationContext = Readonly<{
  path: string
  role: DatabaseRole
}>

export type SchemaMigration = Readonly<{
  id: string
  role: DatabaseRole
  fromVersion: number
  toVersion: number
  migrate: (
    database: Database.Database,
    context: SchemaMigrationContext
  ) => void
}>

/** SQL remains in the role/aggregate owners; this registry only plans order. */
export const schemaMigrations: readonly SchemaMigration[] = Object.freeze([
  ...installationSchemaMigrations,
  ...campaignSchemaMigrations
])

export function resolveSchemaMigrationPath(
  role: DatabaseRole,
  fromVersion: number,
  toVersion = databaseSchemaVersions[role],
  migrations: readonly SchemaMigration[] = schemaMigrations
): readonly SchemaMigration[] | null {
  if (fromVersion === toVersion) return Object.freeze([])
  if (fromVersion > toVersion) return null
  const bySource = new Map<number, SchemaMigration>()
  for (const migration of migrations.filter((entry) => entry.role === role)) {
    if (
      migration.toVersion <= migration.fromVersion ||
      bySource.has(migration.fromVersion)
    )
      throw new Error('Schema migration registry is ambiguous or non-forward')
    bySource.set(migration.fromVersion, migration)
  }
  const path: SchemaMigration[] = []
  let version = fromVersion
  while (version < toVersion) {
    const migration = bySource.get(version)
    if (!migration || migration.toVersion > toVersion) return null
    path.push(migration)
    version = migration.toVersion
  }
  return version === toVersion ? Object.freeze(path) : null
}

export function applySchemaMigrations(
  database: Database.Database,
  context: SchemaMigrationContext,
  migrations: readonly SchemaMigration[] = schemaMigrations
): void {
  const initialVersion = database.pragma('user_version', {
    simple: true
  }) as number
  const targetVersion = databaseSchemaVersions[context.role]
  const path = resolveSchemaMigrationPath(
    context.role,
    initialVersion,
    targetVersion,
    migrations
  )
  if (path === null)
    throw new IncompatibleDataError(context.path, initialVersion, targetVersion)
  database.transaction(() => {
    let version = initialVersion
    for (const migration of path) {
      if (migration.fromVersion !== version)
        throw new Error('Schema migration precondition changed')
      migration.migrate(database, context)
      database.pragma(`user_version = ${migration.toVersion}`)
      version = migration.toVersion
    }
  })()
}
