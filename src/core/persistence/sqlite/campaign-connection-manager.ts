import Database from 'better-sqlite3'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { assertSchemaVersion, configureSqlite } from './database.js'

export interface CampaignConnectionTarget {
  readonly id: string
  readonly databasePath: string
  readonly dataPath?: string
}

export interface CampaignConnectionManagerOptions {
  readonly open?: (path: string) => Database.Database
}

/** Owns the single optional active campaign SQLite handle. */
export class CampaignConnectionManager {
  private active:
    { readonly id: string; readonly database: Database.Database } | undefined
  private readonly open: (path: string) => Database.Database

  constructor(options: CampaignConnectionManagerOptions = {}) {
    this.open = options.open ?? ((path) => new Database(path))
  }

  switch(target: CampaignConnectionTarget): void {
    const next = this.open(target.databasePath)
    try {
      configureSqlite(next)
      assertSchemaVersion(next, target.dataPath, 'campaign')
    } catch (error) {
      next.close()
      throw error
    }
    this.close()
    this.active = { id: target.id, database: next }
  }

  release(id: string): boolean {
    if (this.active?.id !== id) return false
    this.close()
    return true
  }

  close(): void {
    this.active?.database.close()
    this.active = undefined
  }

  activeId(): string | null {
    return this.active?.id ?? null
  }

  visit<T>(visitor: (database: Database.Database) => T): T {
    if (!this.active) throw new CapabilityError('not_found', false)
    return visitor(this.active.database)
  }

  /** Temporary compatibility for aggregate constructors; removed in M2. */
  compatibilityDatabase(): Database.Database {
    if (!this.active) throw new CapabilityError('not_found', false)
    return this.active.database
  }
}
