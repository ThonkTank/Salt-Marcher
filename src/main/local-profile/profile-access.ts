import {
  canonicalProfilePath,
  prepareProfileDirectory,
  profileAccessPaths
} from '../../shared/maintenance/profile-path.js'
import {
  acquireProfileLock,
  assertProfileLockOwner,
  type ProfileLock,
  type ProfileLockOwner
} from './local-profile-lock.js'
import { join } from 'node:path'

export interface ProfileAccess extends ProfileLock {
  readonly profile: string
}

/** All channels acquire the same canonical lock. Legacy leases remain compatible. */
export function acquireProfileAccess(
  profile: string,
  owner: ProfileLockOwner,
  legacyRoot?: string
): ProfileAccess {
  const paths = profileAccessPaths(profile)
  prepareProfileDirectory(paths.locks)
  const acquired: ProfileLock[] = []
  try {
    acquired.push(acquireProfileLock(paths.lock, owner))
    if (legacyRoot) {
      const root = canonicalProfilePath(legacyRoot)
      acquired.push(acquireProfileLock(join(root, 'runtime.lock'), owner))
    }
    return {
      path: paths.lock,
      owner,
      profile: paths.profile,
      release: () => {
        for (const lock of [...acquired].reverse()) lock.release()
      }
    }
  } catch (error) {
    for (const lock of acquired.reverse()) lock.release()
    throw error
  }
}

export function assertProfileAccessOwner(
  profile: string,
  pid: number,
  legacyRoot: string
): void {
  assertProfileLockOwner(profileAccessPaths(profile).lock, pid, 'application')
  assertProfileLockOwner(
    join(canonicalProfilePath(legacyRoot), 'runtime.lock'),
    pid,
    'application'
  )
}
