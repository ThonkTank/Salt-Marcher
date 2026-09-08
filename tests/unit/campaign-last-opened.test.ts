import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignRegistryRepository } from '../../src/core/persistence/sqlite/campaign-registry-repository.js'
import { installationSchemaMigrations } from '../../src/core/persistence/sqlite/installation-schema-migrations.js'
const id = '00000000-0000-4000-8000-000000000001'
const created = '2026-09-01T10:00:00.000Z'
const opened = '2026-09-08T10:00:00.000Z'
afterEach(() => vi.useRealTimers())
describe('campaign last opening', () => {
  it('migrates legacy identities without inventing historical usage', () => {
    const db = new Database(':memory:')
    try {
      db.exec(
        "CREATE TABLE campaigns (id TEXT PRIMARY KEY, name TEXT, created_at TEXT, trashed_at TEXT, status TEXT DEFAULT 'ready'); CREATE TABLE installation_schema_migration (migration_id TEXT PRIMARY KEY, applied_at TEXT)"
      )
      db.prepare(
        'INSERT INTO campaigns (id,name,created_at) VALUES (?,?,?)'
      ).run(id, 'Old', created)
      installationSchemaMigrations
        .find((m) => m.fromVersion === 39)!
        .migrate(db, { path: ':memory:', role: 'installation' })
      const registry = new CampaignRegistryRepository(db)
      registry.initialize()
      expect(registry.snapshot().campaigns[0]).toMatchObject({
        id,
        name: 'Old',
        lastOpenedAt: null
      })
    } finally {
      db.close()
    }
  })
  it('writes timestamps at creation and activation, preserving them on rename and restore', () => {
    vi.useFakeTimers()
    vi.setSystemTime(created)
    const db = new Database(':memory:')
    const registry = new CampaignRegistryRepository(db)
    try {
      registry.initialize()
      registry.beginCreation(id, 'A', created)
      registry.markReadyAndActivate(id)
      expect(registry.snapshot().campaigns[0]?.lastOpenedAt).toBe(created)
      vi.setSystemTime(opened)
      registry.setActive(id)
      registry.rename(id, 'B')
      registry.trash(id, opened)
      expect(registry.snapshot().trashedCampaigns[0]?.lastOpenedAt).toBe(opened)
      registry.restore(id)
      expect(registry.snapshot().activeCampaignId).toBeNull()
      expect(registry.snapshot().campaigns[0]?.lastOpenedAt).toBe(opened)
    } finally {
      db.close()
    }
  })
  it('normalizes legacy receipts without substituting current usage', () => {
    const db = new Database(':memory:')
    const registry = new CampaignRegistryRepository(db)
    try {
      registry.initialize()
      registry.beginCreation(id, 'A', created)
      registry.markReadyAndActivate(id)
      const commandId = '00000000-0000-4000-8000-000000000099'
      const snapshot = {
        revision: 1,
        activeCampaignId: id,
        campaigns: [{ id, name: 'A', createdAt: created }],
        trashedCampaigns: []
      }
      db.prepare('INSERT INTO campaign_commands VALUES (?,?,?,?,?,?)').run(
        commandId,
        'activated',
        '{}',
        id,
        JSON.stringify({
          commandId,
          campaignId: id,
          kind: 'activated',
          snapshot
        }),
        created
      )
      expect(
        registry.commandReceipt(commandId)?.snapshot.campaigns[0]?.lastOpenedAt
      ).toBeNull()
      expect(registry.snapshot().campaigns[0]?.lastOpenedAt).not.toBeNull()
    } finally {
      db.close()
    }
  })
  it('does not record background creation recovery as an opening', () => {
    const db = new Database(':memory:')
    const registry = new CampaignRegistryRepository(db)
    try {
      registry.initialize()
      registry.beginCreation(id, 'A', created)
      registry.markReadyAndActivate(id, 0, undefined, null)
      expect(registry.snapshot().campaigns[0]?.lastOpenedAt).toBeNull()
    } finally {
      db.close()
    }
  })
})
