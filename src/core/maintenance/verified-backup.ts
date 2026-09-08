import { canonicalProfilePath } from '../../shared/maintenance/profile-path.js'
import { readFileSync, lstatSync } from 'node:fs'
import { join } from 'node:path'
import { profileBackupSchema } from '../../shared/contracts/profile-backup.js'
import {
  inventory,
  directoryInventory
} from '../../shared/maintenance/files.js'

/** Hash validation precedes database access; callers recheck after preparation. */
export function readVerifiedBackup(directory: string) {
  try {
    return readBackup(canonicalProfilePath(directory))
  } catch (error) {
    throw new Error(
      'Die Sicherung ist beschädigt, unvollständig oder wurde verändert. Bitte einen geprüften SaltMarcher-Sicherungsordner mit manifest.json und data auswählen.',
      { cause: error }
    )
  }
}

function readBackup(directory: string) {
  if (
    !lstatSync(directory).isDirectory() ||
    !lstatSync(join(directory, 'manifest.json')).isFile()
  )
    throw new Error(
      'Bitte einen unveränderten SaltMarcher-Sicherungsordner auswählen.'
    )
  const manifest = profileBackupSchema.parse(
    JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'))
  )
  const data = join(directory, 'data')
  if (
    !manifest.restorable ||
    JSON.stringify(manifest.files) !== JSON.stringify(inventory(data)) ||
    (manifest.formatVersion === 2 &&
      JSON.stringify(manifest.directories) !==
        JSON.stringify(directoryInventory(data)))
  )
    throw new Error(
      'Die Sicherung ist beschädigt, unvollständig oder wurde verändert.'
    )
  return { manifest, data }
}
