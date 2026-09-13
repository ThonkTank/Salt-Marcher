import { acquireProfileAccess } from '../../src/main/local-profile/profile-access.js'
import { withLaunchReservation } from '../../src/main/local-profile/launch-reservation.js'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ProfileLockedError,
  inspectProfileLock,
  type AcquireProfileLockOptions,
  type ProfileLockOwner
} from '../../src/main/local-profile/local-profile-lock.js'
import {
  canonicalProfilePath,
  profileAccessPaths
} from '../../src/shared/maintenance/profile-path.js'
import {
  LocalInstallationError,
  type LocalInstallationPaths
} from './contract.js'

export function withInstallationLock<T>(
  paths: LocalInstallationPaths,
  operation: () => T
): T {
  try {
    return withLaunchReservation(paths.root, () =>
      withProfileLock(paths, operation)
    )
  } catch (error) {
    if (!(error instanceof ProfileLockedError)) throw error
    throw new LocalInstallationError(
      'installation-locked',
      'An application startup owns the installation reservation',
      { cause: error }
    )
  }
}

function withProfileLock<T>(
  paths: LocalInstallationPaths,
  operation: () => T
): T {
  let lock
  try {
    lock = acquireProfileAccess(paths.profile, 'installer', paths.root)
  } catch (error) {
    if (!(error instanceof ProfileLockedError)) throw error
    throw new LocalInstallationError(
      'installation-locked',
      'SaltMarcher Local or another installer owns the profile lock',
      { cause: error }
    )
  }
  try {
    return operation()
  } finally {
    lock.release()
  }
}

export function isInstalledLocalAppRunning(
  appImagePath: string,
  procRoot = '/proc'
): boolean {
  if (!existsSync(procRoot)) return false
  for (const entry of readdirSync(procRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue
    try {
      const environment = readFileSync(
        join(procRoot, entry.name, 'environ'),
        'utf8'
      ).split('\0')
      if (environment.includes(`APPIMAGE=${appImagePath}`)) return true
      const command = readFileSync(
        join(procRoot, entry.name, 'cmdline'),
        'utf8'
      ).split('\0')
      if (command.includes(appImagePath)) return true
    } catch {
      // Processes may exit or be unreadable while /proc is scanned.
    }
  }
  return false
}

export type LocalInstallationAvailability =
  | Readonly<{ status: 'free' }>
  | Readonly<{ status: 'busy'; lockPath: string; owner: ProfileLockOwner }>
  | Readonly<{ status: 'unknown'; lockPath: string }>

/** Read-only preflight; the final installation lease still closes startup races. */
export function readLocalInstallationAvailability(
  paths: LocalInstallationPaths,
  options: Pick<AcquireProfileLockOptions, 'procRoot' | 'bootIdPath'> = {}
): LocalInstallationAvailability {
  try {
    const root = canonicalProfilePath(paths.root)
    const canonical = profileAccessPaths(paths.profile)
    const locks = [
      canonical.lock,
      canonical.launch,
      join(root, 'runtime.lock'),
      join(root, 'launch.lock')
    ].map((lockPath) => ({
      lockPath,
      result: inspectProfileLock(lockPath, options)
    }))
    const busy = locks.find(({ result }) => result.kind === 'busy')
    if (busy?.result.kind === 'busy')
      return {
        status: 'busy',
        lockPath: busy.lockPath,
        owner: busy.result.owner
      }
    const unknown = locks.find(({ result }) => result.kind === 'unknown')
    if (unknown) return { status: 'unknown', lockPath: unknown.lockPath }
    return { status: 'free' }
  } catch {
    return { status: 'unknown', lockPath: paths.profile }
  }
}

export function assertLocalInstallationAvailable(
  paths: LocalInstallationPaths
): void {
  const availability = readLocalInstallationAvailability(paths)
  if (availability.status === 'free') return
  throw new LocalInstallationError(
    'installation-locked',
    availability.status === 'busy'
      ? `SaltMarcher Local installation is occupied by ${availability.owner}; close it before handoff (${availability.lockPath})`
      : `Cannot reliably determine SaltMarcher Local installation availability; check access and lock metadata (${availability.lockPath})`
  )
}
