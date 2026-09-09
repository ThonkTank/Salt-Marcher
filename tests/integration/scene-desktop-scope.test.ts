import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { SceneDesktopStore } from '../../src/core/scene-desktop/scene-desktop-store.js'
import { SceneDesktopService } from '../../src/core/scene-desktop/scene-desktop-service.js'
import { initialDesktopState } from '../../src/renderer/features/scene-desktop/desktop-state.js'

it('reads scopes without writes and cleans layouts only after successful commands', () => {
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
    const installation = campaigns.installationPersistenceAccess()
    const active = campaigns.activeCampaignPersistence()
    const rows = () =>
      installation.use((db) =>
        db
          .prepare('SELECT * FROM scene_desktop ORDER BY campaign_id, scene_id')
          .all()
      )
    const before = rows()
    installation.use((db) => db.pragma('query_only = ON'))
    active.use((db) => db.pragma('query_only = ON'))
    try {
      expect(service.read(scope).state).toEqual(state)
      expect(() => service.read(missing)).toThrow()
      expect(rows()).toEqual(before)
    } finally {
      installation.use((db) => db.pragma('query_only = OFF'))
      active.use((db) => db.pragma('query_only = OFF'))
    }
    expect(raw.read(missing).state).toEqual(state)
    expect(() =>
      service.save({ ...scope, state, expectedRevision: 0 })
    ).toThrow()
    expect(rows()).toEqual(before)
    expect(() =>
      service.save({ ...missing, state, expectedRevision: 0 })
    ).toThrow()
    installation.use((db) =>
      db.exec(`
      CREATE TEMP TRIGGER fail_desktop_cleanup BEFORE DELETE ON scene_desktop
      BEGIN SELECT RAISE(ABORT, 'cleanup interrupted'); END;
    `)
    )
    expect(() =>
      service.save({
        ...scope,
        state: { ...state, windows: [] },
        expectedRevision: 1
      })
    ).toThrow('cleanup interrupted')
    expect(rows()).toEqual(before)
    installation.use((db) => db.exec('DROP TRIGGER fail_desktop_cleanup'))
    campaigns.create('Scope B')
    const secondCampaignId = campaigns.activeCampaignId()
    // A read of an inactive campaign must not change its persisted journal mode.
    campaigns.visitCampaignDatabase(campaignId, (db) =>
      db.pragma('journal_mode = DELETE')
    )
    expect(service.read(scope).state).toEqual(state)
    campaigns.visitCampaignDatabase(
      campaignId,
      (db) => {
        expect(db.readonly).toBe(true)
        expect(db.pragma('journal_mode', { simple: true })).toBe('delete')
        expect(() =>
          db.exec('CREATE TABLE forbidden_write (id INTEGER)')
        ).toThrow()
      },
      'read'
    )
    const closed = { ...state, windows: [] }
    service.save({ ...scope, state: closed, expectedRevision: 1 })
    expect(raw.read(missing).state).toBeNull()
    expect(campaigns.activeCampaignId()).toBe(secondCampaignId)
    expect(service.read(scope).state).toEqual(closed)
    campaigns.activate(campaignId)
    expect(service.read(scope).state).toEqual(closed)
    service.save({ ...scope, state, expectedRevision: 2 })
    campaigns.trash(campaignId)
    const trashedRows = rows()
    installation.use((db) => db.pragma('query_only = ON'))
    try {
      expect(() => service.read(scope)).toThrow()
      expect(rows()).toEqual(trashedRows)
    } finally {
      installation.use((db) => db.pragma('query_only = OFF'))
    }
    expect(raw.read(scope).state).toEqual(state)
    campaigns.restore(campaignId)
    campaigns.activate(campaignId)
    expect(service.read(scope).state).toEqual(state)
    campaigns.trash(campaignId)
    campaigns.deleteForever(campaignId, 'Scope A')
    expect(() => service.read(scope)).toThrow()
    expect(raw.read(scope).state).toEqual(state)
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
