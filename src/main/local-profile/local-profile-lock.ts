import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'

const profileLockSchema = z
  .object({
    formatVersion: z.literal(1),
    token: z.uuid(),
    owner: z.enum(['application', 'installer']),
    pid: z.number().int().positive(),
    processIdentity: z.string().min(1),
    acquiredAt: z.iso.datetime()
  })
  .strict()

export type ProfileLockOwner = 'application' | 'installer'

export class ProfileLockedError extends Error {
  override readonly name = 'ProfileLockedError'

  constructor(
    readonly lockPath: string,
    readonly owner: ProfileLockOwner | 'unknown',
    options?: ErrorOptions
  ) {
    super(`SaltMarcher profile is locked by ${owner}`, options)
  }
}

export interface ProfileLock {
  readonly path: string
  readonly owner: ProfileLockOwner
  readonly release: () => void
}

export interface AcquireProfileLockOptions {
  readonly procRoot?: string
  readonly bootIdPath?: string
  readonly pid?: number
  readonly now?: () => Date
}

/**
 * Acquires the one lock shared by the Local application and its installer.
 * A PID alone is never stale evidence: Linux boot id, process start tick and
 * executable identity must no longer match before an abandoned lock is moved.
 */
export function acquireProfileLock(
  lockPath: string,
  owner: ProfileLockOwner,
  options: AcquireProfileLockOptions = {}
): ProfileLock {
  const pid = options.pid ?? process.pid
  const procRoot = options.procRoot ?? '/proc'
  const bootIdPath =
    options.bootIdPath ?? join(procRoot, 'sys/kernel/random/boot_id')
  const processIdentity = readProcessIdentity(pid, procRoot, bootIdPath)
  if (processIdentity.kind !== 'known')
    throw new Error(
      'Cannot establish current process identity for profile lock'
    )

  const metadata = profileLockSchema.parse({
    formatVersion: 1,
    token: randomUUID(),
    owner,
    pid,
    processIdentity: processIdentity.value,
    acquiredAt: (options.now ?? (() => new Date()))().toISOString()
  })
  const serialized = `${JSON.stringify(metadata)}\n`

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let descriptor: number | undefined
    try {
      descriptor = openSync(lockPath, 'wx', 0o600)
      writeFileSync(descriptor, serialized)
      fsyncSync(descriptor)
      closeSync(descriptor)
      descriptor = undefined
      syncDirectory(dirname(lockPath))
      return {
        path: lockPath,
        owner,
        release: () => releaseOwnedLock(lockPath, metadata.token)
      }
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor)
      if (errorCode(error) !== 'EEXIST') throw error
      const observed = inspectExistingLock(lockPath, procRoot, bootIdPath)
      if (observed.kind !== 'stale')
        throw new ProfileLockedError(
          lockPath,
          observed.kind === 'live' ? observed.owner : 'unknown',
          { cause: error }
        )
      quarantineStaleLock(lockPath, observed.serialized)
    }
  }
  throw new ProfileLockedError(lockPath, 'unknown')
}

type ProcessIdentity =
  | Readonly<{ kind: 'known'; value: string }>
  | Readonly<{ kind: 'missing' | 'unknown' }>

function readProcessIdentity(
  pid: number,
  procRoot: string,
  bootIdPath: string
): ProcessIdentity {
  try {
    const stat = readFileSync(join(procRoot, String(pid), 'stat'), 'utf8')
    const commandEnd = stat.lastIndexOf(')')
    if (commandEnd < 0) return { kind: 'unknown' }
    const fieldsAfterCommand = stat
      .slice(commandEnd + 2)
      .trim()
      .split(/\s+/)
    const startTicks = fieldsAfterCommand[19]
    if (!startTicks) return { kind: 'unknown' }
    const bootId = readFileSync(bootIdPath, 'utf8').trim()
    let executable: string
    try {
      executable = readlinkSync(join(procRoot, String(pid), 'exe'))
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') return { kind: 'unknown' }
      executable =
        readFileSync(join(procRoot, String(pid), 'cmdline'), 'utf8').split(
          '\0'
        )[0] ?? ''
    }
    if (!bootId || !executable) return { kind: 'unknown' }
    return {
      kind: 'known',
      value: `${bootId}:${startTicks}:${executable}`
    }
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { kind: 'missing' }
    return { kind: 'unknown' }
  }
}

function inspectExistingLock(
  lockPath: string,
  procRoot: string,
  bootIdPath: string
):
  | Readonly<{ kind: 'live'; owner: ProfileLockOwner }>
  | Readonly<{ kind: 'unknown' }>
  | Readonly<{ kind: 'stale'; serialized: string }> {
  try {
    const serialized = readFileSync(lockPath, 'utf8')
    const metadata = profileLockSchema.safeParse(JSON.parse(serialized))
    if (!metadata.success) return { kind: 'unknown' }
    const current = readProcessIdentity(metadata.data.pid, procRoot, bootIdPath)
    if (
      current.kind === 'known' &&
      current.value === metadata.data.processIdentity
    )
      return { kind: 'live', owner: metadata.data.owner }
    if (current.kind === 'unknown') return { kind: 'unknown' }
    return { kind: 'stale', serialized }
  } catch (error) {
    return errorCode(error) === 'ENOENT'
      ? { kind: 'stale', serialized: '' }
      : { kind: 'unknown' }
  }
}

function quarantineStaleLock(lockPath: string, expected: string): void {
  if (!existsSync(lockPath)) return
  const before = lstatSync(lockPath)
  if (!before.isFile() || readFileSync(lockPath, 'utf8') !== expected)
    throw new ProfileLockedError(lockPath, 'unknown')
  const quarantine = `${lockPath}.stale-${randomUUID()}`
  renameSync(lockPath, quarantine)
  try {
    if (readFileSync(quarantine, 'utf8') !== expected) {
      if (!existsSync(lockPath)) renameSync(quarantine, lockPath)
      throw new ProfileLockedError(lockPath, 'unknown')
    }
  } finally {
    rmSync(quarantine, { force: true })
  }
  syncDirectory(dirname(lockPath))
}

function releaseOwnedLock(lockPath: string, token: string): void {
  try {
    const metadata = profileLockSchema.parse(
      JSON.parse(readFileSync(lockPath, 'utf8'))
    )
    if (metadata.token !== token) return
    unlinkSync(lockPath)
    syncDirectory(dirname(lockPath))
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error
  }
}

function syncDirectory(path: string): void {
  const descriptor = openSync(path, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined
  return typeof error.code === 'string' ? error.code : undefined
}
