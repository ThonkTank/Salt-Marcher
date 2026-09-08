import { maintenanceJournalSchema as legacyJournalSchema } from '../fixtures/maintenance-journal-v2.js'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import {
  directoryInventory,
  inventory
} from '../../src/shared/maintenance/files.js'
import { profileBackupSchema } from '../../src/shared/contracts/profile-backup.js'
import {
  preparedMaintenance,
  acceptMaintenance
} from '../support/release-maintenance.js'
const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-complete-profile-'))
  roots.push(root)
  const maintenance = new ProfileMaintenance(root, '0.3.0', 'profile')
  const store = new CampaignStore(maintenance.data)
  store.create('Persistent campaign')
  store.close()
  mkdirSync(join(root, 'profile', 'own-assets', 'empty'), { recursive: true })
  writeFileSync(join(root, 'profile', 'own-assets', 'map.svg'), 'old map')
  return { root, maintenance, profile: join(root, 'profile') }
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('complete profile maintenance', () => {
  it('updates the whole tree, restores all files and preserves later work after commit', async () => {
    const { root, profile, maintenance } = fixture()
    const coordinator = await preparedMaintenance(maintenance)
    expect(coordinator.read()?.formatVersion).toBe(3)
    acceptMaintenance(maintenance, coordinator)
    const backup = maintenance.backups()[0]!
    expect(backup).toMatchObject({ valid: true, scope: 'profile' })
    const manifest = profileBackupSchema.parse(
      JSON.parse(
        readFileSync(join(root, 'backups', backup.id, 'manifest.json'), 'utf8')
      )
    )
    expect(manifest.formatVersion).toBe(2)
    writeFileSync(join(profile, 'own-assets', 'map.svg'), 'later map')
    writeFileSync(join(profile, 'later-file.txt'), 'valuable later work')
    const restore = await preparedMaintenance(
      maintenance,
      maintenance.backupSource(backup.id)
    )
    acceptMaintenance(maintenance, restore)
    expect(readFileSync(join(profile, 'own-assets', 'map.svg'), 'utf8')).toBe(
      'old map'
    )
    expect(existsSync(join(profile, 'own-assets', 'empty'))).toBe(true)
    expect(existsSync(join(profile, 'later-file.txt'))).toBe(false)
    const saved = restore.read()!.backup!
    expect(
      readFileSync(
        join(maintenance.backupSource(saved), 'later-file.txt'),
        'utf8'
      )
    ).toBe('valuable later work')
    writeFileSync(join(profile, 'post-restore.txt'), 'new work')
    restore.rollback()
    expect(readFileSync(join(profile, 'post-restore.txt'), 'utf8')).toBe(
      'new work'
    )
  })

  it.each([
    'prepared',
    'data-moving',
    'old-data-moved',
    'new-data-moved',
    'data-ready',
    'program-moving',
    'program-linked',
    'awaiting-start'
  ])('rolls back a whole profile interrupted at %s', async (boundary) => {
    const { root, profile, maintenance } = fixture()
    const before = inventory(profile)
    const directories = directoryInventory(profile)
    await expect(
      (async () => {
        const coordinator = await preparedMaintenance(
          maintenance,
          undefined,
          (at) => {
            if (at === boundary) throw new Error('power loss')
          }
        )
        coordinator.activate()
      })()
    ).rejects.toThrow('power loss')
    const recovery = new MaintenanceCoordinator(root)
    const id = recovery.read()!.id
    recovery.rollback()
    recovery.rollback()
    expect(inventory(profile)).toEqual(before)
    expect(directoryInventory(profile)).toEqual(directories)
    expect(recovery.read()).toMatchObject({
      phase: 'rolled-back',
      formatVersion: 2
    })
    expect(
      JSON.parse(
        readFileSync(
          join(root, 'maintenance-history', `${id}-rolled-back.json`),
          'utf8'
        )
      )
    ).toMatchObject({ phase: 'rolled-back', formatVersion: 3 })
  })

  it.each([
    'rollback-started',
    'rollback-preserving',
    'failed-data-preserved',
    'rollback-restoring',
    'old-data-restored',
    'rollback-program',
    'program-linked',
    'rollback-history-written',
    'rolled-back'
  ])('resumes a full-profile rollback interrupted at %s', async (boundary) => {
    const { root, profile, maintenance } = fixture()
    const before = inventory(profile)
    const coordinator = await preparedMaintenance(maintenance)
    coordinator.activate()
    expect(legacyJournalSchema.safeParse(coordinator.read()).success).toBe(
      false
    )
    expect(() =>
      new MaintenanceCoordinator(root, (at) => {
        if (at === boundary) throw new Error('power loss')
      }).rollback()
    ).toThrow('power loss')
    const recovery = new MaintenanceCoordinator(root)
    recovery.rollback()
    expect(inventory(profile)).toEqual(before)
    expect(legacyJournalSchema.parse(recovery.read())).toMatchObject({
      formatVersion: 2,
      phase: 'rolled-back'
    })
  })

  it('resumes after history is durable but before the compatible terminal journal', async () => {
    const { root, profile, maintenance } = fixture()
    const before = inventory(profile)
    const coordinator = await preparedMaintenance(maintenance)
    coordinator.activate()
    expect(() =>
      new MaintenanceCoordinator(root, (at) => {
        if (at === 'rollback-history-written') throw new Error('power loss')
      }).rollback()
    ).toThrow('power loss')
    expect(new MaintenanceCoordinator(root).read()?.formatVersion).toBe(3)
    new MaintenanceCoordinator(root).rollback()
    expect(inventory(profile)).toEqual(before)
    expect(new MaintenanceCoordinator(root).read()).toMatchObject({
      formatVersion: 2,
      phase: 'rolled-back'
    })
  })

  it('reads an old campaign-only backup without merging the current profile', async () => {
    const { root, profile, maintenance } = fixture()
    const legacy = new ProfileMaintenance(root, '0.2.0')
    const id = await legacy.backup()
    const prepared = await maintenance.importBackup(
      randomUUID(),
      join(root, 'backups', id!)
    )
    expect(prepared.journalVersion).toBe(3)
    expect(
      existsSync(
        join(
          root,
          `staged-${prepared.id}`,
          'campaign-data',
          'installation.sqlite'
        )
      )
    ).toBe(true)
    expect(existsSync(join(root, `staged-${prepared.id}`, 'own-assets'))).toBe(
      false
    )
    expect(
      existsSync(
        join(
          maintenance.backupSource(prepared.backup!),
          'own-assets',
          'map.svg'
        )
      )
    ).toBe(true)
    expect(existsSync(join(profile, 'own-assets', 'map.svg'))).toBe(true)
  })

  it('detects lost empty directories in a complete backup', async () => {
    const { root, maintenance } = fixture()
    const id = await maintenance.backup()
    rmSync(join(root, 'backups', id!, 'data', 'own-assets', 'empty'), {
      recursive: true
    })
    expect(maintenance.backups()[0]?.valid).toBe(false)
    await expect(
      maintenance.importBackup(randomUUID(), join(root, 'backups', id!))
    ).rejects.toThrow('Sicherung ist beschädigt')
  })
})
