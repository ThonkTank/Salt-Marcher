import Database from 'better-sqlite3'
import { CapabilityError } from '../../../shared/errors/capability-error.js'

export const currentDevelopmentSchemaVersion = 5

export function migrateDevelopmentSchema(
  db: Database.Database,
  migrateVersion3: () => void = () => undefined,
  migrateVersion4: () => void = () => undefined
): void {
  let version = db.pragma('user_version', { simple: true }) as number
  if (version === 3) {
    db.transaction(() => {
      migrateVersion3()
      db.pragma('user_version = 4')
    })()
    version = 4
  }
  if (version === 4)
    db.transaction(() => {
      migrateVersion4()
      db.pragma(`user_version = ${currentDevelopmentSchemaVersion}`)
    })()
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
    throw new CapabilityError(
      'development_data_incompatible',
      false,
      developmentDataPath ? { developmentDataPath } : undefined
    )
}
