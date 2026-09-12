import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { cpSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readVerifiedBackup } from '../../src/core/maintenance/verified-backup.js'
import { profileBackupSchema } from '../../src/shared/contracts/profile-backup.js'
import {
  directoryInventory,
  inventory
} from '../../src/shared/maintenance/files.js'

/** Negative format fixture only: never claims to reproduce a future migration. */
export function createNewerFormatBackup(
  sourceDirectory: string,
  currentVersion: number
) {
  assert(Number.isInteger(currentVersion) && currentVersion > 0)
  const source = readVerifiedBackup(sourceDirectory)
  assert.equal(source.manifest.formatVersion, 2)
  const before = inventory(sourceDirectory)
  const beforeDirectories = directoryInventory(sourceDirectory)
  const id = randomUUID()
  const directory = join(dirname(sourceDirectory), id)
  cpSync(sourceDirectory, directory, {
    recursive: true,
    errorOnExist: true,
    force: false
  })
  const data = join(directory, 'data')
  const database = new DatabaseSync(
    join(data, 'campaign-data', 'installation.sqlite')
  )
  try {
    assert.equal(
      database.prepare('PRAGMA user_version').get()?.['user_version'],
      currentVersion
    )
    database.exec(`PRAGMA user_version = ${currentVersion + 1}`)
  } finally {
    database.close()
  }
  const manifest = profileBackupSchema.parse({
    ...source.manifest,
    id,
    createdAt: new Date().toISOString(),
    version: '999.0.0',
    files: inventory(data),
    directories: directoryInventory(data)
  })
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest))
  const verified = readVerifiedBackup(directory)
  assert.deepEqual(inventory(sourceDirectory), before)
  assert.deepEqual(directoryInventory(sourceDirectory), beforeDirectories)
  return { directory, ...verified, installationVersion: currentVersion + 1 }
}
