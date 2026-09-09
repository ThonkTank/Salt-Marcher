import { statfsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { profileBackupSchema } from '../../shared/contracts/profile-backup.js'
import {
  directoryInventory,
  durableJson,
  inventory
} from '../../shared/maintenance/files.js'
import { snapshotCompleteProfile } from './complete-profile-snapshot.js'
import { readVerifiedBackup } from './verified-backup.js'

/** Main owns a qualified source lease; destination is a fresh private cache folder. */
export async function exportCompleteProfile(
  source: string,
  destination: string,
  version: string
): Promise<string> {
  const required =
    2 * inventory(source).reduce((sum, file) => sum + file.bytes, 0) +
    64 * 1024 * 1024
  const space = statfsSync(destination)
  if (space.bavail * space.bsize < required)
    throw new Error(
      'Nicht genug freier Speicherplatz für die Profilübernahme. Bitte Speicherplatz freigeben und erneut versuchen.'
    )
  const data = join(destination, 'data')
  await snapshotCompleteProfile(source, data)
  const manifest = profileBackupSchema.parse({
    formatVersion: 2,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    version,
    restorable: true,
    directories: directoryInventory(data),
    files: inventory(data)
  })
  durableJson(join(destination, 'manifest.json'), manifest)
  return readVerifiedBackup(destination).manifestSha256
}
