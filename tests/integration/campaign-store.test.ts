import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('CampaignStore', () => {
  it('returns deeply frozen snapshots', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const store = new CampaignStore(root)
    const snapshot = store.create('Frozen Campaign')
    store.close()

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.campaigns)).toBe(true)
    expect(Object.isFrozen(snapshot.campaigns[0])).toBe(true)
  })

  it('reopens the campaign selected after A/B/A walking', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const firstRun = new CampaignStore(root)
    const a = firstRun.create('Campaign A')
    const campaignA = a.activeCampaignId
    firstRun.create('Campaign B')
    firstRun.activate(campaignA ?? '')
    firstRun.close()

    const reopened = new CampaignStore(root)
    const snapshot = reopened.list()
    reopened.close()

    expect(snapshot.campaigns.map((campaign) => campaign.name)).toEqual([
      'Campaign A',
      'Campaign B'
    ])
    expect(snapshot.activeCampaignId).toBe(campaignA)
    expect(existsSync(join(root, 'installation.sqlite'))).toBe(true)
    expect(
      existsSync(join(root, 'campaigns', campaignA ?? '', 'campaign.sqlite'))
    ).toBe(true)
  })

  it.each(['after-store-created', 'before-ready'] as const)(
    'recovers an interrupted creation after %s to one complete campaign',
    (phase) => {
      const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
      roots.push(root)
      const interrupted = new CampaignStore(root, {
        onCreatePhase(currentPhase) {
          if (currentPhase === phase)
            throw new Error('simulated process interruption')
        }
      })

      expect(() => interrupted.create('Recovered Campaign')).toThrow(
        'simulated process interruption'
      )
      interrupted.close()

      const reopened = new CampaignStore(root)
      const snapshot = reopened.list()
      reopened.close()

      expect(snapshot.campaigns).toHaveLength(1)
      expect(snapshot.campaigns[0]?.name).toBe('Recovered Campaign')
      expect(snapshot.activeCampaignId).toBe(snapshot.campaigns[0]?.id)
    }
  )

  it('leaves no registry entry or campaign directory when creation stops before the store exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const interrupted = new CampaignStore(root, {
      onCreatePhase(phase) {
        if (phase === 'after-creating-entry')
          throw new Error('simulated process interruption')
      }
    })

    expect(() => interrupted.create('Discarded Campaign')).toThrow(
      'simulated process interruption'
    )
    interrupted.close()

    const reopened = new CampaignStore(root)
    const snapshot = reopened.list()
    reopened.close()

    expect(snapshot).toEqual({ campaigns: [], activeCampaignId: null })
    expect(existsSync(join(root, 'campaigns', '.creating'))).toBe(false)
  })

  it('does not begin a create when it fails before the registry entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const store = new CampaignStore(root, {
      onCreatePhase(phase) {
        if (phase === 'before-registry-entry')
          throw new Error('injected failure')
      }
    })

    expect(() => store.create('Never Created')).toThrow('injected failure')
    expect(store.list()).toEqual({ campaigns: [], activeCampaignId: null })
    store.close()
  })
})
