import type Database from 'better-sqlite3'

/** Coordinates one atomic application command without owning feature SQL. */
export class CampaignUnitOfWork {
  constructor(private readonly db: Database.Database) {}

  run<T>(operation: () => T): T {
    if (this.db.inTransaction) return operation()
    return this.db.transaction(operation)()
  }
}
