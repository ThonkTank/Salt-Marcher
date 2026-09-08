import Database from 'better-sqlite3'
import { materializeSceneDesktopFixture } from '../../scripts/materialize-scene-desktop-fixture.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SceneDesktopStore,
  initializeSceneDesktopSchema
} from '../../src/core/scene-desktop/scene-desktop-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { initialDesktopState } from '../../src/renderer/features/scene-desktop/desktop-state.js'

import { applySchemaMigrations } from '../../src/core/persistence/sqlite/schema-migrations.js'
import { persistedInstallationPreferences } from '../../src/shared/contracts/settings.js'

const scope = {
  campaignId: '00000000-0000-4000-8000-000000000001',
  sceneId: '00000000-0000-4000-8000-000000000002'
}

describe('installation-owned scene desktops', () => {
  it('reads and upgrades persisted version 1 geometry without writing or changing its revision', () => {
    const db = new Database(':memory:')
    try {
      initializeSceneDesktopSchema(db)
      const old = { windows: initialDesktopState().windows, schemaVersion: 1 }
      db.prepare('INSERT INTO scene_desktop VALUES (?, ?, ?, ?)').run(
        scope.campaignId,
        scope.sceneId,
        7,
        JSON.stringify(old)
      )
      const store = new SceneDesktopStore(fixedSqliteDatabaseAccess(db))
      expect(store.read(scope)).toEqual({
        ...scope,
        revision: 7,
        state: initialDesktopState()
      })
      expect(db.prepare('SELECT state_json FROM scene_desktop').get()).toEqual({
        state_json: JSON.stringify(old)
      })
      expect(
        store.save({
          ...scope,
          expectedRevision: 7,
          state: initialDesktopState()
        }).revision
      ).toBe(8)
    } finally {
      db.close()
    }
  })

  it('materializes the acceptance fixture with independent populated scenes', () => {
    const root = mkdtempSync(join(tmpdir(), 'desktop-fixture-'))
    try {
      materializeSceneDesktopFixture(root)
      const campaigns = new CampaignStore(root)
      try {
        const play = new LivePlayService(campaigns.activeCampaignPersistence())
        const live = play.readSession()
        expect(
          live.scene.scenes.map((scene) => ({
            title: scene.title,
            members: scene.partyMemberIds.length,
            groups: scene.groups.length
          }))
        ).toEqual([
          { title: 'Hafen', members: 1, groups: 1 },
          { title: 'Wald', members: 1, groups: 1 }
        ])
      } finally {
        campaigns.close()
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('upgrades schema 40 preserving theme and removing obsolete preferences once', () => {
    const db = new Database(':memory:')
    try {
      db.exec(
        'PRAGMA user_version = 40; CREATE TABLE installation_schema_migration (migration_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL); CREATE TABLE installation_settings (singleton INTEGER PRIMARY KEY, revision INTEGER, preferences_json TEXT)'
      )
      const preferences = JSON.stringify({
        schemaVersion: 1,
        preferences: {
          theme: 'dark',
          sceneDesktopPreview: false,
          sessionLayout: {
            schemaVersion: 2,
            controlPaneWidth: 300,
            scenarioPaneWidth: 264,
            centerTab: 'details'
          }
        }
      })
      db.prepare('INSERT INTO installation_settings VALUES (1, 7, ?)').run(
        preferences
      )
      applySchemaMigrations(db, { path: ':memory:', role: 'installation' })
      expect(db.pragma('user_version', { simple: true })).toBe(42)
      expect(
        db
          .prepare(
            'SELECT revision, preferences_json FROM installation_settings'
          )
          .get()
      ).toEqual({
        revision: 8,
        preferences_json: JSON.stringify(
          persistedInstallationPreferences({ theme: 'dark' })
        )
      })
      expect(
        new SceneDesktopStore(fixedSqliteDatabaseAccess(db)).read(scope).state
      ).toBeNull()
    } finally {
      db.close()
    }
  })

  it('persists independent scene/campaign revisions and intentional closure across restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'scene-desktop-'))
    let db = new Database(join(directory, 'installation.sqlite'))
    try {
      initializeSceneDesktopSchema(db)
      const store = new SceneDesktopStore(fixedSqliteDatabaseAccess(db))
      expect(store.read(scope)).toEqual({ ...scope, revision: 0, state: null })
      const first = store.save({
        ...scope,
        expectedRevision: 0,
        state: initialDesktopState()
      })
      expect(first.revision).toBe(1)
      const otherScene = {
        ...scope,
        sceneId: '00000000-0000-4000-8000-000000000003'
      }
      const otherCampaign = {
        ...scope,
        campaignId: '00000000-0000-4000-8000-000000000004'
      }
      store.save({
        ...otherScene,
        expectedRevision: 0,
        state: { ...initialDesktopState(), windows: [] }
      })
      expect(store.read(otherCampaign).state).toBeNull()
      expect(() =>
        store.save({
          ...scope,
          expectedRevision: 0,
          state: { ...initialDesktopState(), windows: [] }
        })
      ).toThrow()
      expect(store.read(scope)).toEqual(first)
      db.close()
      db = new Database(join(directory, 'installation.sqlite'))
      const reopened = new SceneDesktopStore(fixedSqliteDatabaseAccess(db))
      expect(reopened.read(scope)).toEqual(first)
      expect(reopened.read(otherScene)).toEqual({
        ...otherScene,
        revision: 1,
        state: { ...initialDesktopState(), windows: [] }
      })
      expect(
        reopened.save({
          ...scope,
          expectedRevision: 1,
          state: { ...initialDesktopState(), windows: [] }
        }).revision
      ).toBe(2)
    } finally {
      db.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('refuses to replace malformed saved state with a default', () => {
    const db = new Database(':memory:')
    try {
      initializeSceneDesktopSchema(db)
      db.prepare('INSERT INTO scene_desktop VALUES (?, ?, 1, ?)').run(
        scope.campaignId,
        scope.sceneId,
        '{broken'
      )
      const store = new SceneDesktopStore(fixedSqliteDatabaseAccess(db))
      expect(() => store.read(scope)).toThrow()
      expect(() =>
        store.save({
          ...scope,
          expectedRevision: 1,
          state: initialDesktopState()
        })
      ).toThrow()
      expect(
        db.prepare('SELECT state_json FROM scene_desktop').pluck().get()
      ).toBe('{broken')
    } finally {
      db.close()
    }
  })
})
