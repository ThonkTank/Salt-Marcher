import { existsSync, rmSync } from 'node:fs'
import { basename } from 'node:path'
import type { LocalInstallationPaths } from '../local-installation/contract.js'
import { withInstallationLock } from '../local-installation/installation-lock.js'
import {
  sha256Pattern,
  type BackupPruneResult,
  type ValidBackup
} from './contract.js'
import { syncDirectory } from './filesystem.js'
import { inspectLocalStorage, validateBackupDirectory } from './inspection.js'

export interface PruneLocalBackupOptions {
  readonly paths: LocalInstallationPaths
  readonly iconSourcePath: string
  readonly backup: string
  readonly confirmManifestSha?: string
  readonly now?: () => Date
  readonly removeDirectory?: (path: string) => void
}

export function pruneLocalBackup(
  options: PruneLocalBackupOptions
): BackupPruneResult {
  assertExactBackupName(options.backup)
  const inspected = selectBackup(options)
  if (typeof inspected === 'string') return refusal(options, inspected)
  if (options.confirmManifestSha === undefined)
    return {
      backup: options.backup,
      manifestSha256: inspected.manifestSha256,
      dryRun: true,
      deleted: false,
      releasedBytes: inspected.bytes,
      refusal: null
    }
  if (!sha256Pattern.test(options.confirmManifestSha))
    return refusal(options, 'Confirmation is not a complete manifest SHA-256')

  return withInstallationLock(options.paths, () => {
    const current = selectBackup(options)
    if (typeof current === 'string') return refusal(options, current)
    if (current.manifestSha256 !== options.confirmManifestSha)
      return refusal(options, 'Confirmation does not match the backup manifest')
    const validated = validateBackupDirectory(
      current.path,
      current.name,
      current.bytes
    )
    if (
      validated.manifestSha256 !== current.manifestSha256 ||
      validated.bytes !== current.bytes
    )
      return refusal(options, 'Backup changed immediately before deletion')
    const removeDirectory =
      options.removeDirectory ??
      ((path: string) => rmSync(path, { recursive: true, force: false }))
    removeDirectory(current.path)
    if (existsSync(current.path))
      throw new Error(`Backup removal was incomplete: ${current.name}`)
    syncDirectory(options.paths.backups)
    return {
      backup: current.name,
      manifestSha256: current.manifestSha256,
      dryRun: false,
      deleted: true,
      releasedBytes: current.bytes,
      refusal: null
    }
  })
}

function selectBackup(options: PruneLocalBackupOptions): ValidBackup | string {
  const inspection = inspectLocalStorage(options)
  const finding = inspection.findings.find(
    ({ area, name }) => area === 'backups' && name === options.backup
  )
  if (finding !== undefined) return `Backup is invalid: ${finding.reason}`
  const backup = inspection.backups.find(({ name }) => name === options.backup)
  if (backup === undefined) return 'Backup does not exist'
  if (backup.protectedByRecency)
    return 'The five newest valid backups cannot be pruned'
  if (backup.protectedByAge)
    return 'Backups younger than 30 days cannot be pruned'
  return backup
}

function assertExactBackupName(name: string): void {
  if (
    name.length === 0 ||
    basename(name) !== name ||
    name === '.' ||
    name === '..' ||
    ['*', '?', '[', ']', '{', '}'].some((character) => name.includes(character))
  )
    throw new Error('Backup pruning accepts one exact direct-child name only')
}

function refusal(
  options: PruneLocalBackupOptions,
  reason: string
): BackupPruneResult {
  return {
    backup: options.backup,
    manifestSha256: null,
    dryRun: options.confirmManifestSha === undefined,
    deleted: false,
    releasedBytes: 0,
    refusal: reason
  }
}
