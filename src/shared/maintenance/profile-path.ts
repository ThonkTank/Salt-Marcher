import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { syncPath } from './files.js'

/** Resolve existing ancestors too, so aliases agree before a profile is created. */
export function canonicalProfilePath(path: string): string {
  let existing = resolve(path)
  const suffix: string[] = []
  while (!existsSync(existing)) {
    const parent = dirname(existing)
    if (parent === existing)
      throw new Error('Der Profilpfad kann nicht aufgelöst werden.')
    suffix.unshift(basename(existing))
    existing = parent
  }
  return join(realpathSync(existing), ...suffix)
}

/** Fsync newly created directory entries before a persistent profile can use them. */
export function prepareProfileDirectory(path: string): string {
  const canonical = canonicalProfilePath(path)
  const missing: string[] = []
  let cursor = canonical
  while (!existsSync(cursor)) {
    missing.unshift(cursor)
    cursor = dirname(cursor)
  }
  mkdirSync(canonical, { recursive: true })
  if (process.platform === 'linux')
    for (const directory of missing) {
      syncPath(directory)
      syncPath(dirname(directory))
    }
  return canonicalProfilePath(canonical)
}

/** Lock identity stays at the same location while the profile tree is replaced. */
export function profileAccessPaths(profile: string) {
  const directory = canonicalProfilePath(profile)
  const key = createHash('sha256').update(directory).digest('hex')
  const locks = join(dirname(directory), '.salt-marcher-locks')
  return {
    profile: directory,
    locks,
    lock: join(locks, `${key}.lock`),
    launch: join(locks, `${key}.launch.lock`)
  }
}
