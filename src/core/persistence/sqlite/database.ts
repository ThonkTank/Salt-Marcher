import Database from 'better-sqlite3'
export const currentDevelopmentSchemaVersion = 27

export class IncompatibleDevelopmentDataError extends Error {
  constructor(public readonly developmentDataPath?: string) {
    super('Incompatible development data')
    this.name = 'IncompatibleDevelopmentDataError'
  }
}

export function configureSqlite(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = FULL')
  db.pragma('busy_timeout = 5000')
}

export function initializeDevelopmentSchemaVersion(
  db: Database.Database
): void {
  db.pragma(`user_version = ${currentDevelopmentSchemaVersion}`)
}

export function assertDevelopmentSchemaVersion(
  db: Database.Database,
  developmentDataPath?: string
): void {
  const version = db.pragma('user_version', { simple: true }) as number
  if (version !== currentDevelopmentSchemaVersion)
    throw new IncompatibleDevelopmentDataError(developmentDataPath)
}
