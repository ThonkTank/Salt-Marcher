import type Database from 'better-sqlite3'

type CampaignVisitor = {
  list(): { activeCampaignId: string | null }
  visitCampaignDatabases<T>(
    visitor: (entry: { id: string; database: Database.Database }) => T
  ): readonly T[]
}

export function withHistoricalActiveCampaign<T>(
  store: CampaignVisitor,
  work: (database: Database.Database) => T
): T {
  const id = store.list().activeCampaignId
  if (!id) throw new Error('Historical fixture has no active campaign')
  const result = store
    .visitCampaignDatabases((entry) =>
      entry.id === id ? { value: work(entry.database) } : undefined
    )
    .find((entry) => entry !== undefined)
  if (!result) throw new Error('Historical active campaign is missing')
  return result.value
}

/** Bridges original callable access and current visitor access inside a fixture owner scope. */
export function historicalDatabaseAccess(database: Database.Database) {
  return Object.assign(() => database, {
    use<T>(visitor: (database: Database.Database) => T): T {
      return visitor(database)
    }
  })
}
