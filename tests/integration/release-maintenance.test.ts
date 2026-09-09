import { snapshotCompleteProfile } from '../../src/core/maintenance/complete-profile-snapshot.js'
import { profileBackupSchema } from '../../src/shared/contracts/profile-backup.js'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { snapshotProfile } from '../../src/core/maintenance/profile-snapshot.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import {
  preparedMaintenance,
  acceptMaintenance
} from '../support/release-maintenance.js'
import { afterEach, describe, expect, it } from 'vitest'
import {
  mkdtempSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { inventory } from '../../src/shared/maintenance/files.js'
const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-release-'))
  roots.push(root)
  const data = join(root, 'profile', 'campaign-data')
  mkdirSync(data, { recursive: true })
  const store = new CampaignStore(data)
  store.create('Meine Kampagne')
  store.close()
  writeFileSync(join(data, 'notes.txt'), 'wertvolle Notizen')
  return { root, data }
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
describe('release maintenance', () => {
  it('snapshots the complete profile including external files and empty directories', async () => {
    const { root, data } = fixture()
    const profile = join(root, 'profile')
    writeFileSync(
      join(profile, 'Preferences'),
      'retained historical preferences'
    )
    mkdirSync(join(profile, 'own-assets', 'empty'), { recursive: true })
    writeFileSync(
      join(profile, 'own-assets', 'map.svg'),
      '<svg>custom map</svg>'
    )
    mkdirSync(join(data, 'own-empty-directory'))
    const development = new CampaignStore(join(profile, 'development-data'))
    development.create('Entwicklung separat')
    development.close()
    const before = inventory(profile)
    const target = join(root, 'complete-copy')
    await snapshotCompleteProfile(profile, target)
    expect(inventory(profile)).toEqual(before)
    expect(readFileSync(join(target, 'Preferences'), 'utf8')).toBe(
      'retained historical preferences'
    )
    expect(readFileSync(join(target, 'own-assets', 'map.svg'), 'utf8')).toBe(
      '<svg>custom map</svg>'
    )
    expect(existsSync(join(target, 'own-assets', 'empty'))).toBe(true)
    expect(
      existsSync(join(target, 'campaign-data', 'own-empty-directory'))
    ).toBe(true)
    const copied = new CampaignStore(join(target, 'campaign-data'))
    expect(copied.list().campaigns[0]?.name).toBe('Meine Kampagne')
    copied.close()
    const copiedDevelopment = new CampaignStore(
      join(target, 'development-data')
    )
    expect(copiedDevelopment.list().campaigns[0]?.name).toBe(
      'Entwicklung separat'
    )
    copiedDevelopment.close()
  })

  it('rejects a complete snapshot destination inside its source without changing it', async () => {
    const { root } = fixture()
    const profile = join(root, 'profile')
    const before = inventory(profile)
    await expect(
      snapshotCompleteProfile(profile, join(profile, 'copy'))
    ).rejects.toThrow('außerhalb des Quellprofils')
    expect(inventory(profile)).toEqual(before)
    expect(existsSync(join(profile, 'copy'))).toBe(false)
  })

  it('imports a verified foreign backup and preserves the replaced campaign first', async () => {
    const origin = fixture()
    const destination = fixture()
    const producer = new ProfileMaintenance(origin.root, '0.2.0')
    const backupId = await producer.backup()
    const backupDirectory = join(origin.root, 'backups', backupId!)
    const sourceBefore = inventory(backupDirectory)
    writeFileSync(
      join(destination.data, 'notes.txt'),
      'current destination work'
    )
    const consumer = new ProfileMaintenance(destination.root, '0.3.0')
    const prepared = await consumer.importBackup(randomUUID(), backupDirectory)
    expect(
      readFileSync(
        join(destination.root, `staged-${prepared.id}`, 'notes.txt'),
        'utf8'
      )
    ).toBe('wertvolle Notizen')
    expect(
      readFileSync(
        join(consumer.backupSource(prepared.backup!), 'notes.txt'),
        'utf8'
      )
    ).toBe('current destination work')
    expect(readFileSync(join(destination.data, 'notes.txt'), 'utf8')).toBe(
      'current destination work'
    )
    expect(inventory(backupDirectory)).toEqual(sourceBefore)
  })

  it('rejects a raw source directory and a modified external backup before preparing data', async () => {
    const source = fixture()
    const destination = fixture()
    const producer = new ProfileMaintenance(source.root, '0.2.0')
    const consumer = new ProfileMaintenance(destination.root, '0.3.0')
    const before = inventory(destination.data)
    await expect(
      consumer.importBackup(randomUUID(), source.data)
    ).rejects.toThrow()
    const id = await producer.backup()
    const directory = join(source.root, 'backups', id!)
    writeFileSync(join(directory, 'data', 'notes.txt'), 'changed after backup')
    await expect(
      consumer.importBackup(randomUUID(), directory)
    ).rejects.toThrow('Sicherung ist beschädigt')
    expect(inventory(destination.data)).toEqual(before)
    expect(consumer.backups()).toEqual([])
  })

  it('rejects an intact backup containing a newer database format', async () => {
    const source = fixture()
    const destination = fixture()
    const producer = new ProfileMaintenance(source.root, '0.2.0')
    const id = await producer.backup()
    const directory = join(source.root, 'backups', id!)
    const database = new Database(
      join(directory, 'data', 'installation.sqlite')
    )
    database.pragma('user_version = 9999')
    database.close()
    const manifestPath = join(directory, 'manifest.json')
    const manifest = profileBackupSchema.parse(
      JSON.parse(readFileSync(manifestPath, 'utf8'))
    )
    manifest.files = inventory(join(directory, 'data'))
    writeFileSync(manifestPath, JSON.stringify(manifest))
    const consumer = new ProfileMaintenance(destination.root, '0.3.0')
    const before = inventory(destination.data)
    await expect(
      consumer.importBackup(randomUUID(), directory)
    ).rejects.toThrow()
    expect(inventory(destination.data)).toEqual(before)
  })

  it('rejects changed backup metadata after preparing a working copy', async () => {
    const source = fixture()
    const destination = fixture()
    const producer = new ProfileMaintenance(source.root, '0.2.0')
    const id = await producer.backup()
    const directory = join(source.root, 'backups', id!)
    const consumer = new ProfileMaintenance(destination.root, '0.3.0')
    const before = inventory(destination.data)
    const pending = consumer.importBackup(randomUUID(), directory)
    const manifestPath = join(directory, 'manifest.json')
    const manifest = profileBackupSchema.parse(
      JSON.parse(readFileSync(manifestPath, 'utf8'))
    )
    manifest.version = '0.2.1'
    writeFileSync(manifestPath, JSON.stringify(manifest))
    await expect(pending).rejects.toThrow(
      'Sicherung wurde während der Übernahme verändert'
    )
    expect(inventory(destination.data)).toEqual(before)
  })

  it('preserves source bytes and custom files during a database snapshot', async () => {
    const { root, data } = fixture()
    const before = inventory(data)
    const target = join(root, 'source-copy')
    await snapshotProfile(data, target)
    expect(inventory(data)).toEqual(before)
    expect(readFileSync(join(target, 'notes.txt'), 'utf8')).toBe(
      'wertvolle Notizen'
    )
  })

  it('rejects source changes while the online backup is pending', async () => {
    const { root, data } = fixture()
    const pending = snapshotProfile(data, join(root, 'source-copy'))
    writeFileSync(join(data, 'notes.txt'), 'concurrent source edit')
    await expect(pending).rejects.toThrow(
      'Quellprofil wurde während der Sicherung verändert'
    )
    expect(readFileSync(join(data, 'notes.txt'), 'utf8')).toBe(
      'concurrent source edit'
    )
  })

  it('backs up a real campaign, activates it and preserves later edits after commit', async () => {
    const { root, data } = fixture()
    const transaction = new ProfileMaintenance(root, '0.2.0')
    const coordinator = await preparedMaintenance(transaction)
    expect(transaction.backups()).toMatchObject([
      { valid: true, version: '0.2.0' }
    ])
    acceptMaintenance(transaction, coordinator)
    writeFileSync(join(data, 'notes.txt'), 'nach dem Update')
    new MaintenanceCoordinator(root).rollback()
    expect(readFileSync(join(data, 'notes.txt'), 'utf8')).toBe(
      'nach dem Update'
    )
    const store = new CampaignStore(data)
    expect(store.list().campaigns[0]?.name).toBe('Meine Kampagne')
    store.close()
  })
  it.each([
    'prepared',
    'data-moving',
    'old-data-moved',
    'new-data-moved',
    'data-ready'
  ])('recovers a crash at %s idempotently', async (phase) => {
    const { root, data } = fixture()
    const before = inventory(data)
    const transaction = new ProfileMaintenance(root, '0.2.0')
    const boundary = (at: string) => {
      if (at === phase) throw new Error('simulated crash')
    }
    await expect(
      (async () => {
        const coordinator = await preparedMaintenance(
          transaction,
          undefined,
          boundary
        )
        coordinator.activate()
      })()
    ).rejects.toThrow('simulated crash')
    const recovery = new MaintenanceCoordinator(root)
    recovery.rollback()
    recovery.rollback()
    expect(inventory(data)).toEqual(before)
  })
  it('restores a backup and backs up the replaced state first', async () => {
    const { root, data } = fixture()
    const transaction = new ProfileMaintenance(root, '0.2.0')
    const id = await transaction.backup()
    writeFileSync(join(data, 'notes.txt'), 'neuere Notizen')
    const coordinator = await preparedMaintenance(
      transaction,
      transaction.backupSource(id!)
    )
    acceptMaintenance(transaction, coordinator)
    expect(readFileSync(join(data, 'notes.txt'), 'utf8')).toBe(
      'wertvolle Notizen'
    )
    expect(transaction.backups()).toHaveLength(2)
    expect(
      transaction
        .backups()
        .some(
          (backup) =>
            readFileSync(
              join(transaction.backupSource(backup.id), 'notes.txt'),
              'utf8'
            ) === 'neuere Notizen'
        )
    ).toBe(true)
  })
  it('refuses a modified backup without replacing the current profile', async () => {
    const { root, data } = fixture()
    const transaction = new ProfileMaintenance(root, '0.2.0')
    const id = await transaction.backup()
    writeFileSync(join(root, 'backups', id!, 'data', 'notes.txt'), 'beschädigt')
    expect(() => transaction.backupSource(id!)).toThrow()
    expect(readFileSync(join(data, 'notes.txt'), 'utf8')).toBe(
      'wertvolle Notizen'
    )
  })
  it('can restore a good backup while preserving a corrupt current profile for recovery', async () => {
    const { root, data } = fixture()
    const transaction = new ProfileMaintenance(root, '0.2.0')
    const id = await transaction.backup()
    writeFileSync(join(data, 'installation.sqlite'), 'damaged database bytes')
    const coordinator = await preparedMaintenance(
      transaction,
      transaction.backupSource(id!)
    )
    acceptMaintenance(transaction, coordinator)
    const raw = transaction.backups().find((backup) => !backup.valid)!
    expect(raw).toBeDefined()
    expect(
      readFileSync(
        join(root, 'backups', raw.id, 'data', 'installation.sqlite'),
        'utf8'
      )
    ).toBe('damaged database bytes')
    const store = new CampaignStore(data)
    expect(store.list().campaigns[0]?.name).toBe('Meine Kampagne')
    store.close()
  })
  it('copies imported data without mutating its source', async () => {
    const source = fixture()
    const target = fixture()
    const before = inventory(source.data)
    const transaction = new ProfileMaintenance(target.root, '0.2.0')
    const coordinator = await preparedMaintenance(transaction, source.data)
    acceptMaintenance(transaction, coordinator)
    expect(inventory(source.data)).toEqual(before)
  })
})
