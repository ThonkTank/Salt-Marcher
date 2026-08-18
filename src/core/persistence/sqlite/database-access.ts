import type Database from 'better-sqlite3'

export interface SqliteDatabaseAccess {
  use<T>(visitor: (database: Database.Database) => T): T
}

export function sqliteDatabaseAccess(
  use: <T>(visitor: (database: Database.Database) => T) => T
): SqliteDatabaseAccess {
  return Object.freeze({ use })
}

/** Explicit test-fixture adapter; production composition uses owner scopes. */
export function fixedSqliteDatabaseAccess(
  database: Database.Database
): SqliteDatabaseAccess {
  return sqliteDatabaseAccess((visitor) => visitor(database))
}
