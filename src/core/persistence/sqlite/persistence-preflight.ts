import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'
import Database from 'better-sqlite3'
import {
  CorruptDataError,
  databaseSchemaVersions,
  IncompatibleDataError,
  type DatabaseRole
} from './database.js'
import {
  resolveSchemaMigrationPath,
  schemaMigrations,
  type SchemaMigration
} from './schema-migrations.js'

export type PreflightDatabase = Readonly<{
  path: string
  role: DatabaseRole
  schemaVersion: number
  expectedVersion: number
  migrations: readonly SchemaMigration[]
}>

export type PersistencePreflight =
  | Readonly<{ kind: 'fresh'; databases: readonly PreflightDatabase[] }>
  | Readonly<{ kind: 'ready'; databases: readonly PreflightDatabase[] }>
  | Readonly<{
      kind: 'migration-required'
      databases: readonly PreflightDatabase[]
    }>

export function preflightPersistence(
  dataRoot: string,
  migrations: readonly SchemaMigration[] = schemaMigrations
): PersistencePreflight {
  const installationPath = join(dataRoot, 'installation.sqlite')
  if (!existsSync(dataRoot) || readdirSync(dataRoot).length === 0)
    return Object.freeze({
      kind: 'fresh',
      databases: Object.freeze([])
    })
  if (!existsSync(installationPath))
    throw new CorruptDataError(installationPath, {
      cause: new Error('Persistence root has data but no installation store')
    })

  const databasePaths = sqliteFiles(dataRoot)
  const databases = databasePaths.map((path) =>
    inspectDatabase(dataRoot, path, migrations)
  )
  if (databases.every((entry) => entry.schemaVersion === entry.expectedVersion))
    return Object.freeze({ kind: 'ready', databases: Object.freeze(databases) })
  const outdated = databases.filter(
    (entry) => entry.schemaVersion !== entry.expectedVersion
  )
  if (outdated.every((entry) => entry.migrations.length > 0))
    return Object.freeze({
      kind: 'migration-required',
      databases: Object.freeze(databases)
    })
  const incompatible = outdated.find((entry) => entry.migrations.length === 0)
  throw new IncompatibleDataError(
    incompatible?.path ?? dataRoot,
    incompatible?.schemaVersion,
    incompatible?.expectedVersion
  )
}

function inspectDatabase(
  dataRoot: string,
  path: string,
  migrations: readonly SchemaMigration[]
): PreflightDatabase {
  const role = databaseRole(dataRoot, path)
  const expectedVersion = databaseSchemaVersions[role]
  let database: Database.Database | undefined
  let snapshotRoot: string | undefined
  try {
    snapshotRoot = mkdtempSync(join(tmpdir(), 'salt-marcher-preflight-'))
    const snapshotPath = join(snapshotRoot, basename(path))
    copyFileSync(path, snapshotPath)
    for (const suffix of ['-wal', '-shm'])
      if (existsSync(`${path}${suffix}`))
        copyFileSync(`${path}${suffix}`, `${snapshotPath}${suffix}`)
    database = new Database(snapshotPath, {
      readonly: true,
      fileMustExist: true
    })
    const result = database.pragma('quick_check') as Array<
      Record<string, unknown>
    >
    if (
      result.length !== 1 ||
      Object.values(result[0] ?? {}).length !== 1 ||
      Object.values(result[0] ?? {})[0] !== 'ok'
    )
      throw new CorruptDataError(path)
    const schemaVersion = database.pragma('user_version', {
      simple: true
    }) as number
    return Object.freeze({
      path,
      role,
      schemaVersion,
      expectedVersion,
      migrations:
        resolveSchemaMigrationPath(
          role,
          schemaVersion,
          expectedVersion,
          migrations
        ) ?? Object.freeze([])
    })
  } catch (error) {
    if (error instanceof CorruptDataError) throw error
    if (errorCode(error) === 'EACCES' || errorCode(error) === 'EPERM')
      throw error
    throw new CorruptDataError(path, { cause: error })
  } finally {
    database?.close()
    if (snapshotRoot !== undefined)
      rmSync(snapshotRoot, { recursive: true, force: true })
  }
}

function databaseRole(dataRoot: string, path: string): DatabaseRole {
  const parts = relative(dataRoot, path).split(sep)
  if (parts.length === 1 && parts[0] === 'installation.sqlite')
    return 'installation'
  if (
    parts.length >= 3 &&
    parts[0] === 'campaigns' &&
    parts.at(-1) === 'campaign.sqlite'
  )
    return 'campaign'
  throw new CorruptDataError(path, {
    cause: new Error('SQLite file has no declared persistence role')
  })
}

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return ''
  return typeof error.code === 'string' ? error.code : ''
}

function sqliteFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink())
      throw new CorruptDataError(path, {
        cause: new Error('Symbolic links are not valid persistence entries')
      })
    if (entry.isDirectory()) files.push(...sqliteFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.sqlite')) files.push(path)
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'))
}
