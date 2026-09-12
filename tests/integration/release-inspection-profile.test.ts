import { IncompatibleDataError } from '../../src/core/persistence/sqlite/database.js'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { readReleaseQualificationProfile } from '../../src/utility/release-qualification/profile.js'
import { inventory } from '../../src/shared/maintenance/files.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function profile() {
  const root = mkdtempSync(join(tmpdir(), 'release-inspection-profile-'))
  roots.push(root)
  const data = join(root, 'campaign-data')
  const store = new CampaignStore(data)
  let ids: string[]
  try {
    ids = ['Active coast', 'Inactive winter', 'Recoverable old coast'].map(
      (name) => store.create(name).activeCampaignId!
    )
    store.trash(ids[2]!)
    store.activate(ids[0]!)
    store.updateSettings({ theme: 'dark' }, store.readSettings().revision)
  } finally {
    store.close()
  }
  mkdirSync(join(root, 'own-content/empty'), { recursive: true })
  writeFileSync(join(root, 'own-content/map.bin'), Buffer.from([0, 255, 17]))
  writeFileSync(join(root, 'preferences.json'), '{"scale":1.25}\n')
  return { root, data, ids }
}
it('reads settings, active/inactive/deleted campaigns and original custom bytes through domain owners', () => {
  const value = profile()
  const result = readReleaseQualificationProfile(value.root)
  expect(result.registry.activeCampaignId).toBe(value.ids[0])
  expect(
    result.campaigns.map(({ name, trashed }) => ({ name, trashed }))
  ).toEqual([
    { name: 'Active coast', trashed: false },
    { name: 'Inactive winter', trashed: false },
    { name: 'Recoverable old coast', trashed: true }
  ])
  expect(result.settings.preferences.theme).toBe('dark')
  expect(result.preferences).toBe('{"scale":1.25}\n')
  expect(result.ownFiles).toEqual([
    { path: 'empty', kind: 'directory' },
    { path: 'map.bin', kind: 'file', base64: 'AP8R' }
  ])
  expect(readReleaseQualificationProfile(value.root)).toEqual(result)
})
it('never migrates a mismatched format as a side effect of inspection', () => {
  const value = profile()
  const database = new Database(join(value.data, 'installation.sqlite'))
  database.pragma('user_version = 99')
  database.close()
  const before = inventory(value.root)
  expect(() => readReleaseQualificationProfile(value.root)).toThrow(
    IncompatibleDataError
  )
  expect(inventory(value.root)).toEqual(before)
})
