import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignConnectionManager } from '../../src/core/persistence/sqlite/campaign-connection-manager.js'
import {
  configureSqlite,
  initializeSchemaVersion
} from '../../src/core/persistence/sqlite/database.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('CampaignConnectionManager', () => {
  it('owns one handle and closes it exactly once across switch and release', () => {
    const root = fixture()
    const opened: Database.Database[] = []
    const closes: Array<ReturnType<typeof vi.spyOn>> = []
    const manager = new CampaignConnectionManager({
      open(path) {
        const database = new Database(path)
        opened.push(database)
        closes.push(vi.spyOn(database, 'close'))
        return database
      }
    })
    manager.switch(target(root, 'a'))
    manager.switch(target(root, 'b'))
    expect(manager.activeId()).toBe('b')
    expect(closes[0]).toHaveBeenCalledTimes(1)
    expect(manager.release('a')).toBe(false)
    expect(manager.release('b')).toBe(true)
    expect(closes[1]).toHaveBeenCalledTimes(1)
    expect(manager.activeId()).toBeNull()
    expect(opened).toHaveLength(2)
  })

  it('keeps the prior handle when opening the next campaign fails', () => {
    const root = fixture()
    const manager = new CampaignConnectionManager()
    manager.switch(target(root, 'a'))
    expect(() =>
      manager.switch({
        id: 'broken',
        databasePath: join(root, 'broken.sqlite'),
        dataPath: root
      })
    ).toThrow()
    expect(manager.activeId()).toBe('a')
    expect(manager.visit((database) => database.open)).toBe(true)
    manager.close()
  })
})

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-connections-'))
  roots.push(root)
  for (const id of ['a', 'b']) {
    const database = new Database(join(root, `${id}.sqlite`))
    configureSqlite(database)
    initializeSchemaVersion(database, 'campaign')
    database.close()
  }
  return root
}

function target(root: string, id: string) {
  return {
    id,
    databasePath: join(root, `${id}.sqlite`),
    dataPath: root
  }
}
