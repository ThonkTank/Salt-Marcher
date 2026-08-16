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
  openCampaignStore
} from '../../src/core/persistence/sqlite/campaign-store.js'
import Database from 'better-sqlite3'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import {
  configureSqlite,
  currentSchemaVersion
} from '../../src/core/persistence/sqlite/database.js'
import { GeneratorPresetStore } from '../../src/core/persistence/sqlite/generator-preset-store.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('CampaignStore', () => {
  it('installs the generated V3 system preset and exposes explicit campaign context', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const campaignId = campaigns.create('Explicit Context').activeCampaignId!
    const snapshot = new GeneratorPresetStore(
      campaigns.installationDatabase()
    ).readEditor(campaignId)

    expect(snapshot.registry.presets).toHaveLength(1)
    expect(snapshot.registry.presets[0]).toMatchObject({
      id: systemGeneratorPresetId,
      schemaVersion: 4,
      config: { composition: { crBlocks: { min: 1, max: 3 } } }
    })
    expect(snapshot.assignment).toEqual({
      campaignId,
      assignedPresetId: null,
      effectivePresetId: systemGeneratorPresetId
    })
    campaigns.close()
  })

  it('returns exact idempotent receipts and cascades permanent campaign deletion', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const campaign = campaigns.create('Preset Campaign')
    const campaignId = campaign.activeCampaignId ?? ''
    const presets = new GeneratorPresetStore(campaigns.installationDatabase())

    const initial = presets.readEditor(campaignId)
    expect(initial.registry.revision).toBe(0)
    expect(() =>
      presets.update({
        commandId: '00000000-0000-4000-8000-000000000101',
        expectedRegistryRevision: 0,
        id: systemGeneratorPresetId,
        name: 'Nicht erlaubt',
        config: defaultGeneratorConfig
      })
    ).toThrow(CapabilityError)
    expect(() =>
      presets.delete({
        commandId: '00000000-0000-4000-8000-000000000102',
        expectedRegistryRevision: 0,
        id: systemGeneratorPresetId
      })
    ).toThrow(CapabilityError)
    expect(presets.registry().revision).toBe(0)

    const createCommand = {
      commandId: '00000000-0000-4000-8000-000000000103',
      expectedRegistryRevision: 0,
      name: 'Düstere Küste',
      config: {
        ...defaultGeneratorConfig,
        combat: { mobThreshold: 8 }
      }
    }
    const created = presets.create(createCommand)
    const custom = created.saved
    expect(created.registry.revision).toBe(1)
    expect(presets.create(createCommand)).toEqual(created)
    expect(presets.commandReceipt(createCommand.commandId)).toEqual(created)

    const assigned = presets.assign({
      commandId: '00000000-0000-4000-8000-000000000104',
      expectedRegistryRevision: created.registry.revision,
      campaignId,
      presetId: custom.id
    })
    expect(assigned.registry.revision).toBe(2)
    expect(assigned.assignment.assignedPresetId).toBe(custom.id)
    expect(assigned.effectivePreset).toEqual(custom)
    const systemFallback = presets.assign({
      commandId: '00000000-0000-4000-8000-000000000106',
      expectedRegistryRevision: assigned.registry.revision,
      campaignId,
      presetId: systemGeneratorPresetId
    })
    expect(systemFallback.assignment).toEqual({
      campaignId,
      assignedPresetId: null,
      effectivePresetId: systemGeneratorPresetId
    })
    expect(systemFallback.effectivePreset.id).toBe(systemGeneratorPresetId)
    expect(() =>
      presets.assign({
        commandId: '00000000-0000-4000-8000-000000000105',
        expectedRegistryRevision: 0,
        campaignId,
        presetId: custom.id
      })
    ).toThrow(CapabilityError)

    campaigns.trash(campaignId)
    campaigns.deleteForever(campaignId, 'Preset Campaign')
    const orphan = campaigns
      .installationDatabase()
      .prepare(
        'SELECT campaign_id FROM campaign_generator_presets WHERE campaign_id=?'
      )
      .get(campaignId)
    expect(orphan).toBeUndefined()
    campaigns.close()
  })

  it('copies without assigning and reports every campaign affected by preset deletion', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const campaignA = campaigns.create('Campaign A').activeCampaignId!
    const campaignB = campaigns.create('Campaign B').activeCampaignId!
    const presets = new GeneratorPresetStore(campaigns.installationDatabase())

    const created = presets.create({
      commandId: '00000000-0000-4000-8000-000000000120',
      expectedRegistryRevision: 0,
      name: 'Shared Preset',
      config: defaultGeneratorConfig
    })
    expect(presets.readEditor(campaignA).assignment).toMatchObject({
      assignedPresetId: null,
      effectivePresetId: systemGeneratorPresetId
    })
    expect(presets.readEditor(campaignB).assignment).toMatchObject({
      assignedPresetId: null,
      effectivePresetId: systemGeneratorPresetId
    })

    const assignedA = presets.assign({
      commandId: '00000000-0000-4000-8000-000000000121',
      expectedRegistryRevision: created.registry.revision,
      campaignId: campaignA,
      presetId: created.saved.id
    })
    const assignedB = presets.assign({
      commandId: '00000000-0000-4000-8000-000000000122',
      expectedRegistryRevision: assignedA.registry.revision,
      campaignId: campaignB,
      presetId: created.saved.id
    })
    const deleted = presets.delete({
      commandId: '00000000-0000-4000-8000-000000000123',
      expectedRegistryRevision: assignedB.registry.revision,
      id: created.saved.id
    })

    expect(deleted).toMatchObject({
      kind: 'deleted',
      deletedId: created.saved.id,
      affectedCampaignIds: [campaignA, campaignB],
      registry: { revision: 4 }
    })
    for (const campaignId of [campaignA, campaignB])
      expect(presets.readEditor(campaignId).assignment).toEqual({
        campaignId,
        assignedPresetId: null,
        effectivePresetId: systemGeneratorPresetId
      })
    campaigns.close()
  })

  it('bounds the command journal and rejects reusing an id for another operation', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const campaignId = campaigns.create('Journal').activeCampaignId!
    const presets = new GeneratorPresetStore(campaigns.installationDatabase())
    const commandId = '00000000-0000-4000-8000-000000000130'
    const created = presets.create({
      commandId,
      expectedRegistryRevision: 0,
      name: 'Journal Preset',
      config: defaultGeneratorConfig
    })
    expect(() =>
      presets.delete({
        commandId,
        expectedRegistryRevision: created.registry.revision,
        id: created.saved.id
      })
    ).toThrow(CapabilityError)

    for (let index = 0; index < 512; index += 1)
      presets.assign({
        commandId: `00000000-0000-4000-8000-${String(index + 200).padStart(12, '0')}`,
        expectedRegistryRevision: created.registry.revision,
        campaignId,
        presetId: null
      })
    const count = campaigns
      .installationDatabase()
      .prepare('SELECT COUNT(*) AS count FROM generator_preset_commands')
      .get() as { count: number }
    expect(count.count).toBe(512)
    expect(presets.commandReceipt(commandId)).toBeNull()
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

    const rebuilt = openCampaignStore(root, 'reset')
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

    const rebuilt = openCampaignStore(root, 'reset')
    expect(rebuilt.list().campaigns).toEqual([])
    rebuilt.close()
  })

  it('preserves incompatible data byte-for-byte under preserve policy', () => {
    const parent = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(parent)
    const root = join(parent, 'campaign-data')
    const store = new CampaignStore(root)
    store.create('Valuable Campaign')
    store.close()
    const databasePath = join(root, 'installation.sqlite')
    const db = new Database(databasePath)
    db.pragma('user_version = 2')
    db.close()
    const before = readFileSync(databasePath)

    expect(() => openCampaignStore(root, 'preserve')).toThrow()
    expect(readFileSync(databasePath)).toEqual(before)
  })

  it('does not treat arbitrary startup failures as disposable schema data', () => {
    const parent = mkdtempSync(join(tmpdir(), 'salt-marcher-campaign-store-'))
    roots.push(parent)
    const root = join(parent, 'development-data')
    writeFileSync(root, 'preserve')

    expect(() => openCampaignStore(root, 'reset')).toThrow()
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
      currentSchemaVersion
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
