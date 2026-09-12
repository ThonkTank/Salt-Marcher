import Database from 'better-sqlite3'
import { expect, it } from 'vitest'
import {
  historicalDatabaseAccess,
  withHistoricalActiveCampaign
} from '../../scripts/qualification/historical-runtime/database-scope.js'

it('uses only the active owner callback and supports both original access protocols', () => {
  const first = new Database(':memory:')
  const active = new Database(':memory:')
  let insideOwner = false
  const visited: Database.Database[] = []
  try {
    const result = withHistoricalActiveCampaign(
      {
        list: () => ({ activeCampaignId: 'active' }),
        visitCampaignDatabases<T>(
          visitor: (entry: { id: string; database: Database.Database }) => T
        ) {
          insideOwner = true
          try {
            return [
              { id: 'inactive', database: first },
              { id: 'active', database: active }
            ].map(visitor)
          } finally {
            insideOwner = false
          }
        }
      },
      (database) => {
        expect(insideOwner).toBe(true)
        visited.push(database)
        const access = historicalDatabaseAccess(database)
        expect(access()).toBe(active)
        return access.use((db) => {
          expect(db).toBe(active)
          return 42
        })
      }
    )
    expect(result).toBe(42)
    expect(visited).toEqual([active])
    expect(insideOwner).toBe(false)
  } finally {
    first.close()
    active.close()
  }
})

it('rejects absent active campaigns and propagates owner errors', () => {
  expect(() =>
    withHistoricalActiveCampaign(
      {
        list: () => ({ activeCampaignId: null }),
        visitCampaignDatabases: () => {
          throw new Error('must not open')
        }
      },
      () => 0
    )
  ).toThrow('no active campaign')
  expect(() =>
    withHistoricalActiveCampaign(
      {
        list: () => ({ activeCampaignId: 'missing' }),
        visitCampaignDatabases: () => []
      },
      () => 0
    )
  ).toThrow('active campaign is missing')
  expect(() =>
    withHistoricalActiveCampaign(
      {
        list: () => ({ activeCampaignId: 'active' }),
        visitCampaignDatabases: () => {
          throw new Error('owner failure')
        }
      },
      () => 0
    )
  ).toThrow('owner failure')
})
