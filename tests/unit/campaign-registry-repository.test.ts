import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CampaignRegistryRepository } from '../../src/core/persistence/sqlite/campaign-registry-repository.js'

describe('CampaignRegistryRepository', () => {
  it('does not import file-system or campaign-handle owners', () => {
    const source = readFileSync(
      'src/core/persistence/sqlite/campaign-registry-repository.ts',
      'utf8'
    )
    expect(source).not.toContain("from 'node:fs'")
    expect(source).not.toContain('CampaignConnectionManager')
    expect(source).not.toContain('campaign-store')
  })

  it('owns registry state without file-system or campaign-database access', () => {
    const database = new Database(':memory:')
    const registry = new CampaignRegistryRepository(database)
    registry.initialize()
    expect(registry.snapshot().revision).toBe(0)
    const first = '00000000-0000-4000-8000-000000000001'
    const second = '00000000-0000-4000-8000-000000000002'
    registry.beginCreation(first, 'First', '2026-08-18T12:00:00.000Z')
    expect(registry.snapshot().revision).toBe(0)
    registry.markReadyAndActivate(first)
    registry.beginCreation(second, 'Second', '2026-08-18T12:01:00.000Z')
    registry.markReadyAndActivate(second)
    registry.trash(second, '2026-08-18T12:02:00.000Z')
    expect(registry.snapshot()).toMatchObject({
      revision: 3,
      campaigns: [{ id: first, name: 'First' }],
      trashedCampaigns: [{ id: second, name: 'Second' }],
      activeCampaignId: null
    })
    expect(() => registry.rename(first, 'Stale rename', 2)).toThrow(
      expect.objectContaining({ code: 'stale', retryable: true })
    )
    expect(registry.snapshot()).toMatchObject({
      revision: 3,
      campaigns: [{ id: first, name: 'First' }]
    })
    registry.requireTrashed(second)
    registry.restore(second)
    registry.rename(second, 'Restored')
    expect(registry.snapshot().revision).toBe(5)
    expect(registry.snapshot().campaigns).toContainEqual(
      expect.objectContaining({ id: second, name: 'Restored' })
    )
    database.close()
  })

  it('commits, reads back, and compensates lifecycle metadata atomically', () => {
    const database = new Database(':memory:')
    const registry = new CampaignRegistryRepository(database)
    registry.initialize()
    const id = '00000000-0000-4000-8000-000000000001'
    registry.beginCreation(id, 'Original', '2026-08-18T12:00:00.000Z')
    registry.markReadyAndActivate(id)
    const receipt = {
      schemaVersion: 2 as const,
      lifecycleId: '00000000-0000-4000-8000-000000000099',
      operation: { kind: 'replacement' as const },
      mode: 'replace' as const,
      campaignId: id,
      previousName: 'Original',
      replacementName: 'Replacement',
      previousActiveId: id,
      phase: 'reopened' as const,
      validation: { quickCheck: 'ok' },
      updatedAt: '2026-08-18T12:01:00.000Z'
    }
    registry.commitLifecycle(receipt)
    expect(registry.snapshot().revision).toBe(2)
    expect(registry.lifecycleCommit(receipt)).toBe(true)
    expect(registry.lifecycleReadback(receipt)).toBe(true)
    expect(registry.snapshot().campaigns[0]?.name).toBe('Replacement')
    registry.restoreLifecycleRegistry(receipt)
    expect(registry.snapshot().revision).toBe(3)
    expect(registry.lifecycleCommit(receipt)).toBe(false)
    expect(registry.snapshot().campaigns[0]?.name).toBe('Original')
    database.close()
  })
})
