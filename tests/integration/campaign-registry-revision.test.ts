import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('Campaign registry revision', () => {
  it('advances once for every lifecycle command and survives restart', () => {
    const root = createRoot()
    const store = new CampaignStore(root)

    const first = store.create('First', 0)
    const firstId = first.activeCampaignId!
    expect(first.revision).toBe(1)
    const second = store.create('Second', 1)
    expect(second.revision).toBe(2)
    expect(store.activate(firstId, 2).revision).toBe(3)
    expect(store.rename(firstId, 'Renamed', 3).revision).toBe(4)
    expect(store.trash(firstId, 4).revision).toBe(5)
    expect(store.restore(firstId, 5).revision).toBe(6)
    expect(store.trash(firstId, 6).revision).toBe(7)
    expect(store.deleteForever(firstId, 'Renamed', 7).revision).toBe(8)
    store.close()

    const reopened = new CampaignStore(root)
    expect(reopened.list()).toMatchObject({
      revision: 8,
      campaigns: [{ name: 'Second' }],
      trashedCampaigns: []
    })
    reopened.close()
  })

  it('rejects stale authority before registry, connection, or file effects', () => {
    const root = createRoot()
    const store = new CampaignStore(root)
    const first = store.create('First', 0)
    const firstId = first.activeCampaignId!
    const second = store.create('Second', 1)
    const secondId = second.activeCampaignId!

    expectStale(() => store.create('Stale create', 1))
    expectStale(() => store.activate(firstId, 1))
    expectStale(() => store.rename(firstId, 'Stale rename', 1))
    expectStale(() => store.trash(firstId, 1))
    expect(store.list()).toMatchObject({
      revision: 2,
      activeCampaignId: secondId,
      campaigns: [{ id: firstId, name: 'First' }, { id: secondId }]
    })
    expect(existsSync(join(root, 'campaigns', firstId))).toBe(true)

    expect(store.trash(firstId, 2).revision).toBe(3)
    expectStale(() => store.restore(firstId, 2))
    expectStale(() => store.deleteForever(firstId, 'First', 2))
    expect(store.list()).toMatchObject({
      revision: 3,
      activeCampaignId: secondId,
      trashedCampaigns: [{ id: firstId, name: 'First' }]
    })
    expect(existsSync(join(root, 'campaigns', '.trash', firstId))).toBe(true)
    expect(existsSync(join(root, 'campaigns', '.deleting', firstId))).toBe(
      false
    )
    store.close()
  })
})

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-registry-revision-'))
  roots.push(root)
  return root
}

function expectStale(operation: () => unknown): void {
  expect(operation).toThrow(
    expect.objectContaining({ code: 'stale', retryable: true })
  )
}
