import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { canonicalProfilePath } from '../../shared/maintenance/profile-path.js'
import {
  inventory,
  directoryInventory,
  syncTree
} from '../../shared/maintenance/files.js'
import { snapshotProfile } from './profile-snapshot.js'

/** Includes empty directories. inventory rejects links and special files first. */
function profileContents(root: string) {
  const files = inventory(root)
  const directories = directoryInventory(root)
  return { files, directories }
}

/** Caller owns the logical profile; browser writes must live outside this tree. */
export async function snapshotCompleteProfile(
  source: string,
  target: string
): Promise<void> {
  source = canonicalProfilePath(source)
  target = canonicalProfilePath(target)
  const destination = relative(source, target)
  if (
    destination === '' ||
    (!isAbsolute(destination) && destination.split(sep)[0] !== '..')
  )
    throw new Error('Die Sicherung muss außerhalb des Quellprofils liegen.')
  const before = profileContents(source)
  mkdirSync(target, { recursive: false })
  const databaseRoots = ['campaign-data', 'development-data']
  for (const entry of readdirSync(source).sort()) {
    if (databaseRoots.includes(entry)) continue
    cpSync(join(source, entry), join(target, entry), {
      recursive: true,
      errorOnExist: true,
      force: false
    })
  }
  for (const name of databaseRoots) {
    const data = join(source, name)
    if (existsSync(data)) await snapshotProfile(data, join(target, name))
  }
  // The SQLite snapshot copies files; retain empty directories as well.
  for (const directory of before.directories)
    mkdirSync(join(target, directory), { recursive: true })
  syncTree(target)
  if (JSON.stringify(profileContents(source)) !== JSON.stringify(before))
    throw new Error(
      'Das vollständige Quellprofil wurde während der Sicherung verändert.'
    )
}
