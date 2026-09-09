import { preflightPersistence } from '@historical/preflight'
import { applySchemaMigrations } from '@historical/migrations'
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export function migrateHistoricalProfileData(
  profile: string,
  readback: (profile: string) => unknown
) {
  if (!existsSync(join(dirname(profile), 'historical-working-copy.json')))
    throw new Error('Historical migration requires a marked working copy')
  const data = join(profile, 'campaign-data')
  const before = preflightPersistence(data)
  if (before.kind === 'fresh')
    throw new Error('Historical migration requires existing data')
  const transitions = before.databases.map((entry) => {
    const database = new Database(entry.path, { fileMustExist: true })
    try {
      database.pragma('foreign_keys = ON')
      database.pragma('journal_mode = WAL')
      database.pragma('synchronous = FULL')
      applySchemaMigrations(database, { path: entry.path, role: entry.role })
      database.pragma('wal_checkpoint(TRUNCATE)')
      if (
        database.pragma('integrity_check', { simple: true }) !== 'ok' ||
        (database.pragma('foreign_key_check') as unknown[]).length
      )
        throw new Error('Historical migration failed integrity validation')
      return {
        path: relative(data, entry.path),
        role: entry.role,
        fromVersion: entry.schemaVersion,
        toVersion: database.pragma('user_version', { simple: true }),
        migrations: entry.migrations.map(({ id }) => id)
      }
    } finally {
      database.close()
    }
  })
  return { transitions, profile: readback(profile) }
}
