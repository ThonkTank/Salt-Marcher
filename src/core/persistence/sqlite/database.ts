import Database from 'better-sqlite3'
export type DatabaseRole = 'installation' | 'campaign'

export const databaseSchemaVersions: Readonly<Record<DatabaseRole, number>> =
  Object.freeze({ installation: 37, campaign: 34 })

export const currentSchemaVersion = Math.max(
  ...Object.values(databaseSchemaVersions)
)

export class IncompatibleDataError extends Error {
  constructor(
    public readonly dataPath?: string,
    public readonly actualVersion?: number,
    public readonly expectedVersion = currentSchemaVersion
  ) {
    super('Incompatible persisted data')
    this.name = 'IncompatibleDataError'
  }
}

export class CorruptDataError extends Error {
  constructor(
    public readonly dataPath: string,
    options?: ErrorOptions
  ) {
    super(`Persisted data is corrupt: ${dataPath}`, options)
    this.name = 'CorruptDataError'
  }
}

export function configureSqlite(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = FULL')
  db.pragma('busy_timeout = 5000')
}

export function initializeSchemaVersion(
  db: Database.Database,
  role: DatabaseRole
): void {
  db.pragma(`user_version = ${databaseSchemaVersions[role]}`)
}

export function assertSchemaVersion(
  db: Database.Database,
  dataPath?: string,
  role: DatabaseRole = 'campaign'
): void {
  const version = db.pragma('user_version', { simple: true }) as number
  if (version !== databaseSchemaVersions[role])
    throw new IncompatibleDataError(
      dataPath,
      version,
      databaseSchemaVersions[role]
    )
}
