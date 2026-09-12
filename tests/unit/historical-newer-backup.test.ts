import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import { createNewerFormatBackup } from '../../scripts/qualification/historical-newer-backup.js'
import {
  inventory,
  directoryInventory
} from '../../src/shared/maintenance/files.js'
import { readVerifiedBackup } from '../../src/core/maintenance/verified-backup.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
it('creates an intact newer-format copy while retaining the complete original backup', () => {
  const root = mkdtempSync(join(tmpdir(), 'salt-newer-backup-'))
  roots.push(root)
  const id = randomUUID()
  const source = join(root, id)
  const data = join(source, 'data')
  mkdirSync(join(data, 'campaign-data'), { recursive: true })
  mkdirSync(join(data, 'own', 'empty'), { recursive: true })
  writeFileSync(join(data, 'own', 'notes.txt'), 'retained notes')
  const db = new DatabaseSync(
    join(data, 'campaign-data', 'installation.sqlite')
  )
  db.exec(
    "CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES ('retained'); PRAGMA user_version = 42"
  )
  db.close()
  writeFileSync(
    join(source, 'manifest.json'),
    JSON.stringify({
      formatVersion: 2,
      id,
      createdAt: new Date().toISOString(),
      version: '0.2.0',
      restorable: true,
      files: inventory(data),
      directories: directoryInventory(data)
    })
  )
  const before = inventory(source)
  const newer = createNewerFormatBackup(source, 42)
  expect(inventory(source)).toEqual(before)
  expect(readVerifiedBackup(newer.directory).manifest).toEqual(newer.manifest)
  expect(newer.manifest.id).not.toBe(id)
  expect(directoryInventory(newer.data)).toEqual(directoryInventory(data))
  const changed = inventory(newer.data).filter(
    (file) =>
      JSON.stringify(file) !==
      JSON.stringify(inventory(data).find((old) => old.path === file.path))
  )
  expect(changed.map((file) => file.path)).toEqual([
    'campaign-data/installation.sqlite'
  ])
  const copy = new DatabaseSync(
    join(newer.data, 'campaign-data', 'installation.sqlite'),
    { readOnly: true }
  )
  expect(copy.prepare('PRAGMA user_version').get()?.['user_version']).toBe(43)
  expect(copy.prepare('SELECT value FROM fixture').get()?.['value']).toBe(
    'retained'
  )
  copy.close()
})
