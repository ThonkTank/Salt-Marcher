import {
  canonicalProfilePath,
  prepareProfileDirectory,
  profileAccessPaths
} from '../../shared/maintenance/profile-path.js'
import { join } from 'node:path'
import { acquireProfileLock, type ProfileLock } from './local-profile-lock.js'

/** Covers the gap before legacy applications acquire their own profile lock. */
export function withLaunchReservation<T>(root: string, operation: () => T): T {
  const reservation = acquireLaunchReservation(root)
  try {
    return operation()
  } finally {
    reservation.release()
  }
}

/** Explicit lifetime for asynchronous operations; release only after completion. */
export function acquireLaunchReservation(root: string): ProfileLock {
  root = canonicalProfilePath(root)
  const paths = profileAccessPaths(join(root, 'profile'))
  prepareProfileDirectory(paths.locks)
  const canonical = acquireProfileLock(paths.launch, 'installer')
  try {
    const legacy = acquireProfileLock(join(root, 'launch.lock'), 'installer')
    return {
      path: canonical.path,
      owner: canonical.owner,
      release: () => {
        legacy.release()
        canonical.release()
      }
    }
  } catch (error) {
    canonical.release()
    throw error
  }
}
