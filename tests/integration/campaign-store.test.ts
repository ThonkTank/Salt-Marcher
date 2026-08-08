import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CampaignStore,
  openDevelopmentCampaignStore
} from '../../src/core/persistence/sqlite/campaign-store.js'
import Database from 'better-sqlite3'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import {
  configureSqlite,
  currentDevelopmentSchemaVersion
} from '../../src/core/persistence/sqlite/database.js'
import { GeneratorPresetStore } from '../../src/core/persistence/sqlite/generator-preset-store.js'
import {
  legacySystemGeneratorPresetId,
  systemGeneratorPresetId
} from '../../src/shared/contracts/generator-presets.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('CampaignStore', () => {
  it('reads generator presets and migrates the legacy system preset id', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const database = campaigns.installationDatabase()
    database
      .prepare('UPDATE generator_presets SET id=? WHERE id=?')
      .run(legacySystemGeneratorPresetId, systemGeneratorPresetId)

    const snapshot = new GeneratorPresetStore(database).read(null)

    expect(snapshot.presets).toHaveLength(1)
    expect(snapshot.presets[0]?.id).toBe(systemGeneratorPresetId)
    expect(snapshot.presets[0]?.config.maxCounts.standard).toBe(6)
    campaigns.close()
  })

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

    expect(snapshot).toEqual({
      campaigns: [],
      trashedCampaigns: [],
      activeCampaignId: null
    })
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
    expect(store.list()).toEqual({
      campaigns: [],
      trashedCampaigns: [],
      activeCampaignId: null
    })
    store.close()
  })

  it('stores installation preferences with optimistic revisions', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const store = new CampaignStore(root)
    const initial = store.readSettings()
    const updated = store.updateSettings(
      {
        ...initial.preferences,
        theme: 'dark',
        sessionLayout: {
          ...initial.preferences.sessionLayout,
          controlPaneWidth: 340
        }
      },
      initial.revision
    )

    expect(updated).toMatchObject({
      revision: initial.revision + 1,
      preferences: {
        theme: 'dark',
        sessionLayout: { controlPaneWidth: 340 }
      }
    })
    expect(() =>
      store.updateSettings(initial.preferences, initial.revision)
    ).toThrowError(new CapabilityError('stale', true))
    store.close()

    const reopened = new CampaignStore(root)
    expect(reopened.readSettings()).toEqual(updated)
    reopened.close()
  })

  it('rebuilds incompatible development data without touching siblings', () => {
    const parent = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(parent)
    const root = join(parent, 'development-data')
    mkdirSync(root, { recursive: true })
    const store = new CampaignStore(root)
    store.create('Disposable Campaign')
    store.close()
    mkdirSync(join(parent, 'keep-me'))
    const db = new Database(join(root, 'installation.sqlite'))
    db.pragma('user_version = 2')
    db.close()

    const rebuilt = openDevelopmentCampaignStore(root)
    expect(rebuilt.list()).toEqual({
      activeCampaignId: null,
      campaigns: [],
      trashedCampaigns: []
    })
    expect(existsSync(join(parent, 'keep-me'))).toBe(true)
    rebuilt.close()
  })

  it('rebuilds when the selected campaign database is incompatible', () => {
    const parent = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(parent)
    const root = join(parent, 'development-data')
    const store = new CampaignStore(root)
    const campaignId = store.create('Disposable Campaign').activeCampaignId!
    store.close()
    const db = new Database(
      join(root, 'campaigns', campaignId, 'campaign.sqlite')
    )
    db.pragma('user_version = 2')
    db.close()

    const rebuilt = openDevelopmentCampaignStore(root)
    expect(rebuilt.list().campaigns).toEqual([])
    rebuilt.close()
  })

  it('does not treat arbitrary startup failures as disposable schema data', () => {
    const parent = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(parent)
    const root = join(parent, 'development-data')
    writeFileSync(root, 'preserve')

    expect(() => openDevelopmentCampaignStore(root)).toThrow()
    expect(readFileSync(root, 'utf8')).toBe('preserve')
  })

  it('configures durable SQLite pragmas for the installation store', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const store = new CampaignStore(root)
    const db = new Database(join(root, 'installation.sqlite'))
    configureSqlite(db)

    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(db.pragma('synchronous', { simple: true })).toBe(2)
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000)
    expect(db.pragma('user_version', { simple: true })).toBe(
      currentDevelopmentSchemaVersion
    )

    db.close()
    store.close()
  })

  it('renames, trashes, restores and permanently deletes campaigns', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const store = new CampaignStore(root)
    const created = store.create('Die Salzstraße')
    const id = created.activeCampaignId!

    expect(store.rename(id, 'Die Küstenstraße').campaigns[0]?.name).toBe(
      'Die Küstenstraße'
    )
    const trashed = store.trash(id)
    expect(trashed).toMatchObject({
      activeCampaignId: null,
      campaigns: [],
      trashedCampaigns: [{ id, name: 'Die Küstenstraße' }]
    })
    expect(existsSync(join(root, 'campaigns', id))).toBe(false)
    expect(existsSync(join(root, 'campaigns', '.trash', id))).toBe(true)

    const restored = store.restore(id)
    expect(restored.activeCampaignId).toBeNull()
    expect(restored.campaigns[0]?.name).toBe('Die Küstenstraße')
    expect(restored.trashedCampaigns).toEqual([])
    expect(existsSync(join(root, 'campaigns', id))).toBe(true)

    store.trash(id)
    expect(() => store.deleteForever(id, 'falscher Name')).toThrowError(
      new CapabilityError('validation_failed', false)
    )
    const deleted = store.deleteForever(id, 'Die Küstenstraße')
    expect(deleted).toEqual({
      activeCampaignId: null,
      campaigns: [],
      trashedCampaigns: []
    })
    expect(existsSync(join(root, 'campaigns', '.trash', id))).toBe(false)
    expect(existsSync(join(root, 'campaigns', '.deleting', id))).toBe(false)
    store.close()
  })

  it('completes interrupted trash and permanent-delete directory transitions', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const first = new CampaignStore(root)
    const id = first.create('Unterbrochen').activeCampaignId!
    first.close()

    const installation = new Database(join(root, 'installation.sqlite'))
    installation
      .prepare('UPDATE campaigns SET trashed_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
    installation.close()

    const recoveredTrash = new CampaignStore(root)
    expect(recoveredTrash.list().trashedCampaigns[0]?.id).toBe(id)
    expect(existsSync(join(root, 'campaigns', '.trash', id))).toBe(true)
    recoveredTrash.close()

    mkdirSync(join(root, 'campaigns', '.deleting'), { recursive: true })
    renameSync(
      join(root, 'campaigns', '.trash', id),
      join(root, 'campaigns', '.deleting', id)
    )
    const recoveredDelete = new CampaignStore(root)
    expect(recoveredDelete.list()).toEqual({
      activeCampaignId: null,
      campaigns: [],
      trashedCampaigns: []
    })
    expect(existsSync(join(root, 'campaigns', '.deleting', id))).toBe(false)
    recoveredDelete.close()
  })
})
