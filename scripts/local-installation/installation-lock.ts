import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  acquireProfileLock,
  ProfileLockedError
} from '../../src/main/local-profile/local-profile-lock.js'
import {
  LocalInstallationError,
  type LocalInstallationPaths
} from './contract.js'

export function withInstallationLock<T>(
  paths: LocalInstallationPaths,
  operation: () => T
): T {
  let lock
  try {
    lock = acquireProfileLock(paths.lock, 'installer')
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
