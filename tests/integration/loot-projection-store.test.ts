import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { LootService } from '../../src/core/application/loot-service.js'
import { LootProjectionStore } from '../../src/core/loot/loot-projection-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'

const roots: string[] = []
const stores: CampaignStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('Loot projections', () => {
  it('keeps scene shape focused and excludes the independently loaded inbox', () => {
    const { db, loot } = harness()
    const scenes = new SceneStore(db)
    const sceneId = scenes.focusedSceneId()
    const groupId = scenes.saveGroup(
      sceneId,
      null,
      'Gruppe',
      '',
      'neutral',
      [],
      scenes.revision(),
      null
    )
    const group = loot.create({
      commandId: randomUUID(),
      label: 'Gruppenfund',
      anchor: { kind: 'group', sceneId, groupId, lastKnownLabel: 'ignored' },
      items: [{ name: 'Ring', quantity: 1, unitValueCp: 10, stackable: false }]
    })
    const unplaced = loot.create({
      commandId: randomUUID(),
      label: 'Inboxfund',
      anchor: { kind: 'unplaced' },
      items: [{ name: 'Karte', quantity: 1, unitValueCp: 1, stackable: false }]
    })

    const projection = loot.sceneProjection(sceneId)
    expect(projection).toEqual(
      expect.objectContaining({
        sceneId,
        locationId: null,
        locationTreasures: []
      })
    )
    expect(projection.groupTreasures).toEqual([
      { groupId, treasures: [expect.objectContaining({ id: group.id })] }
    ])
    expect(JSON.stringify(projection)).not.toContain(unplaced.id)
    const inboxEntries = loot.inbox({ cursor: null, limit: 20 }).entries
    expect(inboxEntries).toHaveLength(1)
    expect(inboxEntries[0]?.reason).toBe('unplaced')
    expect(inboxEntries[0]?.treasure.id).toBe(unplaced.id)
  })

  it('paginates by a stable cursor and batch-hydrates only each selected page', () => {
    const { db, loot } = harness()
    const originalIds = Array.from(
      { length: 5 },
      (_, index) =>
        loot.create({
          commandId: randomUUID(),
          label: `Fund ${index}`,
          anchor: { kind: 'unplaced' },
          containers: [
            {
              id: randomUUID(),
              catalogContainerId: null,
              name: 'Beutel',
              capacity: 10
            }
          ],
          items: [
            {
              name: `Münze ${index}`,
              quantity: 2,
              unitValueCp: 1,
              stackable: true
            }
          ]
        }).id
    )
    const references = {
      locationIds: new Set<string>(),
      sceneGroups: new Map()
    }
    const firstCounter = countedDatabase(db)
    const first = new LootProjectionStore(firstCounter.database).inbox(
      { cursor: null, limit: 2 },
      references
    )
    expect(first.entries).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    expect(firstCounter.queries()).toBe(4)
    expect(firstCounter.hydratedRootCounts()).toEqual([2, 2])

    const insertedAfterCursor = loot.create({
      commandId: randomUUID(),
      label: 'Später',
      anchor: { kind: 'unplaced' },
      items: [{ name: 'Neu', quantity: 1, unitValueCp: 1, stackable: false }]
    })
    const second = loot.inbox({ cursor: first.nextCursor, limit: 2 })
    const third = loot.inbox({ cursor: second.nextCursor, limit: 2 })
    const pagedIds = [
      ...first.entries,
      ...second.entries,
      ...third.entries
    ].map(({ treasure }) => treasure.id)
    expect(new Set(pagedIds).size).toBe(5)
    expect(pagedIds.toSorted()).toEqual(originalIds.toSorted())
    expect(pagedIds).not.toContain(insertedAfterCursor.id)
    expect(third.nextCursor).toBeNull()
  })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-loot-projection-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  stores.push(campaigns)
  campaigns.create('Loot projection test')
  const db = campaigns.activeCampaignDatabase()
  return {
    db,
    loot: new LootService(
      () => db,
      () => new Date('2026-08-09T10:00:00.000Z')
    )
  }
}

function countedDatabase(database: Database.Database): {
  database: Database.Database
  queries: () => number
  hydratedRootCounts: () => number[]
} {
  let queries = 0
  const hydratedRootCounts: number[] = []
  const proxy = new Proxy(database, {
    get(target, property) {
      if (property === 'prepare')
        return (sql: string) => {
          queries += 1
          const statement = target.prepare(sql)
          if (/WHERE (?:item\.)?treasure_id IN/.test(sql))
            return new Proxy(statement, {
              get(statementTarget, statementProperty) {
                if (statementProperty === 'all')
                  return (serializedIds: string) => {
                    hydratedRootCounts.push(
                      (JSON.parse(serializedIds) as string[]).length
                    )
                    return statementTarget.all(serializedIds)
                  }
                const value = Reflect.get(
                  statementTarget,
                  statementProperty,
                  statementTarget
                ) as unknown
                return typeof value === 'function'
                  ? (value.bind(statementTarget) as unknown)
                  : value
              }
            })
          return statement
        }
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === 'function'
        ? (value.bind(target) as unknown)
        : value
    }
  })
  return {
    database: proxy,
    queries: () => queries,
    hydratedRootCounts: () => hydratedRootCounts
  }
}
