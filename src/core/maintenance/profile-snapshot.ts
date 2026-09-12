import Database from 'better-sqlite3'
import { InstallationDatabaseOwner } from '../persistence/sqlite/installation-database-owner.js'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { inventory, syncTree } from '../../shared/maintenance/files.js'
import { preflightPersistence } from '../persistence/sqlite/persistence-preflight.js'
import {
  applySchemaMigrations,
  schemaMigrations,
  type SchemaMigration
} from '../persistence/sqlite/schema-migrations.js'
import { configureSqlite } from '../persistence/sqlite/database.js'

/** Call only while the owning profile is exclusively locked. */
export async function onlineBackupDatabase(
  source: string,
  destination: string
): Promise<void> {
  const scratch = mkdtempSync(join(tmpdir(), 'salt-snapshot-'))
  const snapshot = join(scratch, 'source.sqlite')
  let database: Database.Database | undefined
  try {
    copyFileSync(source, snapshot)
    for (const suffix of ['-wal', '-shm'])
      if (existsSync(`${source}${suffix}`))
        copyFileSync(`${source}${suffix}`, `${snapshot}${suffix}`)
    database = new Database(snapshot, { readonly: true, fileMustExist: true })
    await database.backup(destination)
    // A completed backup is standalone: even read-only inspection must not
    // create WAL/SHM files next to its immutable inventory.
    const completed = new Database(destination, { fileMustExist: true })
    try {
      completed.pragma('journal_mode = DELETE')
    } finally {
      completed.close()
    }
  } finally {
    database?.close()
    rmSync(scratch, { recursive: true, force: true })
  }
}
export async function snapshotProfile(
  source: string,
  target: string
): Promise<void> {
  const preflight = preflightPersistence(source)
  const files = inventory(source)
  const owned = new Set(
    preflight.databases.flatMap(({ path }) => {
      const name = relative(source, path)
      return [name, `${name}-wal`, `${name}-shm`]
    })
  )
  mkdirSync(target, { recursive: false })
  for (const file of files) {
    if (owned.has(file.path)) continue
    const destination = join(target, file.path)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(source, file.path), destination)
  }
  for (const database of preflight.databases) {
    const destination = join(target, relative(source, database.path))
    mkdirSync(dirname(destination), { recursive: true })
    await onlineBackupDatabase(database.path, destination)
  }
  validateProfile(target, false)
  for (const database of preflight.databases)
    for (const suffix of ['-wal', '-shm'])
      rmSync(`${join(target, relative(source, database.path))}${suffix}`, {
        force: true
      })
  syncTree(target)
  if (JSON.stringify(inventory(source)) !== JSON.stringify(files))
    throw new Error(
      'Das Quellprofil wurde während der Sicherung verändert. Bitte die Quell-App schließen und erneut versuchen.'
    )
}
export function migrateProfile(
  root: string,
  migrations: readonly SchemaMigration[] = schemaMigrations
): void {
  const preflight = preflightPersistence(root, migrations)
  if (preflight.kind === 'fresh') {
    // Bootstrap only the prepared working copy before aggregate readback.
    const installation = new InstallationDatabaseOwner(root)
    installation.close()
  }
  for (const item of preflight.databases) {
    const database = new Database(item.path, { fileMustExist: true })
    try {
      configureSqlite(database)
      applySchemaMigrations(
        database,
        { path: item.path, role: item.role },
        migrations
      )
      database.pragma('wal_checkpoint(TRUNCATE)')
    } finally {
      database.close()
    }
  }
  validateProfile(root, true, migrations)
  syncTree(root)
}
export function validateProfile(
  root: string,
  current: boolean,
  migrations: readonly SchemaMigration[] = schemaMigrations
): void {
  const result = preflightPersistence(root, migrations)
  if (current && result.kind !== 'fresh' && result.kind !== 'ready')
    throw new Error('Datenmigration ist unvollständig.')
  for (const item of result.databases) {
    const db = new Database(item.path, { readonly: true, fileMustExist: true })
    try {
      const integrity = db.pragma('integrity_check') as Array<
        Record<string, unknown>
      >
      if (
        integrity.length !== 1 ||
        Object.values(integrity[0]!)[0] !== 'ok' ||
        (db.pragma('foreign_key_check') as unknown[]).length !== 0
      )
        throw new Error(
          'Die Integritätsprüfung der Sicherung ist fehlgeschlagen.'
        )
    } finally {
      db.close()
    }
  }
}
