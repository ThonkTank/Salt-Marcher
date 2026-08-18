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
    const first = '00000000-0000-4000-8000-000000000001'
    const second = '00000000-0000-4000-8000-000000000002'
    registry.beginCreation(first, 'First', '2026-08-18T12:00:00.000Z')
    registry.markReadyAndActivate(first)
    registry.beginCreation(second, 'Second', '2026-08-18T12:01:00.000Z')
    registry.markReadyAndActivate(second)
    registry.trash(second, '2026-08-18T12:02:00.000Z')
    expect(registry.snapshot()).toMatchObject({
      campaigns: [{ id: first, name: 'First' }],
      trashedCampaigns: [{ id: second, name: 'Second' }],
      activeCampaignId: null
    })
    registry.requireTrashed(second)
    registry.restore(second)
    registry.rename(second, 'Restored')
    expect(registry.snapshot().campaigns).toContainEqual(
      expect.objectContaining({ id: second, name: 'Restored' })
    )
    database.close()
  })

  it('commits and compensates replacement metadata atomically', () => {
    const database = new Database(':memory:')
    const registry = new CampaignRegistryRepository(database)
    registry.initialize()
    const id = '00000000-0000-4000-8000-000000000001'
    registry.beginCreation(id, 'Original', '2026-08-18T12:00:00.000Z')
    registry.markReadyAndActivate(id)
    const receipt = {
      schemaVersion: 1 as const,
      transitionId: '00000000-0000-4000-8000-000000000099',
      campaignId: id,
      previousName: 'Original',
      replacementName: 'Replacement',
      previousActiveId: id,
      phase: 'replacement_promoted' as const,
      updatedAt: '2026-08-18T12:01:00.000Z'
    }
    registry.commitReplacement(receipt, 'Replacement')
    expect(registry.replacementCommit(receipt)).toBe(true)
    expect(registry.snapshot().campaigns[0]?.name).toBe('Replacement')
    registry.restoreReplacementRegistry(receipt)
    expect(registry.replacementCommit(receipt)).toBe(false)
    expect(registry.snapshot().campaigns[0]?.name).toBe('Original')
    database.close()
  })
})
