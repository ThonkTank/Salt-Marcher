import {
  canonicalProfilePath,
  prepareProfileDirectory,
  profileAccessPaths
} from '../../shared/maintenance/profile-path.js'
import { join } from 'node:path'
import { acquireProfileLock } from './local-profile-lock.js'

/** Covers the gap before legacy applications acquire their own profile lock. */
export function withLaunchReservation<T>(root: string, operation: () => T): T {
  root = canonicalProfilePath(root)
  const paths = profileAccessPaths(join(root, 'profile'))
  prepareProfileDirectory(paths.locks)
  const canonical = acquireProfileLock(paths.launch, 'installer')
  try {
    return withLegacyReservation(root, operation)
  } finally {
    canonical.release()
  }
}

function withLegacyReservation<T>(root: string, operation: () => T): T {
  const reservation = acquireProfileLock(join(root, 'launch.lock'), 'installer')
  try {
    return operation()
  } finally {
    reservation.release()
  }
}
