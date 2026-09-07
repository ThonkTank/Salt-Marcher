import { afterEach, describe, expect, it } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { ProfileTransaction } from '../../src/core/maintenance/profile-transaction.js'
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
  it('backs up a real campaign, activates it and preserves later edits after commit', async () => {
    const { root, data } = fixture()
    const transaction = new ProfileTransaction(root, '0.2.0')
    await transaction.prepare()
    expect(transaction.backups()).toMatchObject([
      { valid: true, version: '0.2.0' }
    ])
    transaction.activate()
    transaction.commit()
    writeFileSync(join(data, 'notes.txt'), 'nach dem Update')
    new ProfileTransaction(root, '0.2.0').rollback()
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
    const transaction = new ProfileTransaction(root, '0.2.0', (at) => {
      if (at === phase) throw new Error('simulated crash')
    })
    await expect(
      (async () => {
        await transaction.prepare()
        transaction.activate()
      })()
    ).rejects.toThrow('simulated crash')
    const recovery = new ProfileTransaction(root, '0.2.0')
    recovery.rollback()
    recovery.rollback()
    expect(inventory(data)).toEqual(before)
  })
  it('restores a backup and backs up the replaced state first', async () => {
    const { root, data } = fixture()
    const transaction = new ProfileTransaction(root, '0.2.0')
    const id = await transaction.backup()
    writeFileSync(join(data, 'notes.txt'), 'neuere Notizen')
    await transaction.prepare(transaction.backupSource(id!))
    transaction.activate()
    transaction.commit()
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
    const transaction = new ProfileTransaction(root, '0.2.0')
    const id = await transaction.backup()
    writeFileSync(join(root, 'backups', id!, 'data', 'notes.txt'), 'beschädigt')
    expect(() => transaction.backupSource(id!)).toThrow()
    expect(readFileSync(join(data, 'notes.txt'), 'utf8')).toBe(
      'wertvolle Notizen'
    )
  })
  it('can restore a good backup while preserving a corrupt current profile for recovery', async () => {
    const { root, data } = fixture()
    const transaction = new ProfileTransaction(root, '0.2.0')
    const id = await transaction.backup()
    writeFileSync(join(data, 'installation.sqlite'), 'damaged database bytes')
    await transaction.prepare(transaction.backupSource(id!))
    transaction.activate()
    transaction.commit()
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
    const transaction = new ProfileTransaction(target.root, '0.2.0')
    await transaction.prepare(source.data)
    transaction.activate()
    transaction.commit()
    expect(inventory(source.data)).toEqual(before)
  })
})
