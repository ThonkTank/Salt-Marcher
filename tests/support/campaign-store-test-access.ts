import type Database from 'better-sqlite3'
import type { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'

/** Test-only escape hatch for SQL-level persistence assertions and fixtures. */
export function activeCampaignDatabase(
  campaigns: CampaignStore
): Database.Database {
  return campaigns.activeCampaignPersistence().use((database) => database)
}

/** Test-only escape hatch for installation-store assertions and fixtures. */
export function installationDatabase(
  campaigns: CampaignStore
): Database.Database {
  return campaigns.installationPersistenceAccess().use((database) => database)
}
