import { join } from 'node:path'
import { acquireProfileLock } from './local-profile-lock.js'

/** Covers the gap before legacy applications acquire their own profile lock. */
export function withLaunchReservation<T>(root: string, operation: () => T): T {
  const reservation = acquireProfileLock(join(root, 'launch.lock'), 'installer')
  try {
    return operation()
  } finally {
    reservation.release()
  }
}
