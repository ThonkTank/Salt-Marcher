import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { SceneDesktopStore } from '../../src/core/scene-desktop/scene-desktop-store.js'
import { SceneDesktopService } from '../../src/core/scene-desktop/scene-desktop-service.js'
import { initialDesktopState } from '../../src/renderer/features/scene-desktop/desktop-state.js'

it('rejects orphan scopes, preserves trashed campaign layouts and purges permanent deletion', () => {
  const root = mkdtempSync(join(tmpdir(), 'desktop-scope-'))
  const campaigns = new CampaignStore(root)
  try {
    campaigns.create('Scope A')
    const campaignId = campaigns.activeCampaignId()
    const sceneId = campaigns
      .activeCampaignPersistence()
      .use((db) => new SceneStore(db).focusedSceneId())
    const service = new SceneDesktopService(campaigns)
    const raw = new SceneDesktopStore(campaigns.installationPersistenceAccess())
    const scope = { campaignId, sceneId }
    const state = initialDesktopState()
    service.save({ ...scope, state, expectedRevision: 0 })
    const missing = {
      campaignId,
      sceneId: '00000000-0000-4000-8000-000000000099'
    }
    raw.save({ ...missing, state, expectedRevision: 0 })
    expect(() => service.read(missing)).toThrow()
    expect(raw.read(missing).state).toBeNull()
    expect(() =>
      service.save({ ...missing, state, expectedRevision: 0 })
    ).toThrow()
    campaigns.create('Scope B')
    const secondCampaignId = campaigns.activeCampaignId()
    const closed = { ...state, windows: [] }
    service.save({ ...scope, state: closed, expectedRevision: 1 })
    expect(campaigns.activeCampaignId()).toBe(secondCampaignId)
    expect(service.read(scope).state).toEqual(closed)
    campaigns.activate(campaignId)
    expect(service.read(scope).state).toEqual(closed)
    service.save({ ...scope, state, expectedRevision: 2 })
    campaigns.trash(campaignId)
    expect(() => service.read(scope)).toThrow()
    expect(raw.read(scope).state).toEqual(state)
    campaigns.restore(campaignId)
    campaigns.activate(campaignId)
    expect(service.read(scope).state).toEqual(state)
    campaigns.trash(campaignId)
    campaigns.deleteForever(campaignId, 'Scope A')
    service.cleanupCampaigns()
    expect(raw.read(scope).state).toBeNull()
    expect(() =>
      service.save({ ...scope, state, expectedRevision: 0 })
    ).toThrow()
  } finally {
    campaigns.close()
    rmSync(root, { recursive: true, force: true })
  }
})
