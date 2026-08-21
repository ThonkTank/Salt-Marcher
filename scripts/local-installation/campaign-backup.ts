import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { z } from 'zod'
import {
  shortBuildFingerprint,
  type BuildInfo
} from '../../src/shared/contracts/build-info.js'
import {
  assertCurrentLocalPersistenceVersion,
  localPersistenceFormatVersions
} from '../../src/shared/contracts/local-persistence-format-versions.js'
import type { PreflightDatabase } from '../../src/core/persistence/sqlite/persistence-preflight.js'
import { sha256File } from '../file-hash.js'
import type { LocalInstallJournal } from '../local-install-journal.js'
import {
  LocalInstallationError,
  type LocalInstallationPaths
} from './contract.js'
import {
  copyTreeWithHashes,
  directoryHasEntries,
  hashFileInventory,
  hashTree,
  hashTreeOrEmpty
} from './campaign-file-inventory.js'

export function campaignDataHash(paths: LocalInstallationPaths): string {
  return hashFileInventory(hashTreeOrEmpty(paths.campaignData))
}

export function validateBackupCheckpoint(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal
): void {
  const currentHash = campaignDataHash(paths)
  if (
    journal.sourceDataHash === null ||
    journal.campaignDataHash === null ||
    journal.campaignDataHash !== currentHash
  )
    throw new LocalInstallationError(
      'data-corrupt',
      'Campaign data changed after the verified backup checkpoint'
    )
  if (journal.backupPath === null) {
    if (journal.backupManifestSha256 !== null)
      throw new Error('Backup checkpoint has a hash without a backup')
    return
  }
  const manifestPath = join(journal.backupPath, 'backup-manifest.json')
  if (
    !existsSync(manifestPath) ||
    journal.backupManifestSha256 !== sha256File(manifestPath)
  )
    throw new LocalInstallationError(
      'data-corrupt',
      'Verified campaign backup is missing or changed'
    )
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assertCurrentLocalPersistenceVersion(raw, 'campaignBackupManifest')
  const backupManifest = z
    .object({
      files: z.array(
        z
          .object({
            path: z.string().min(1),
            bytes: z.number().int().nonnegative(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/)
          })
          .strict()
      )
    })
    .passthrough()
    .parse(raw)
  const actualFiles = hashTree(journal.backupPath).filter(
    ({ path }) => path !== 'backup-manifest.json'
  )
  if (
    JSON.stringify(actualFiles) !== JSON.stringify(backupManifest.files) ||
    hashFileInventory(actualFiles) !== journal.sourceDataHash
  )
    throw new LocalInstallationError(
      'data-corrupt',
      'Verified campaign backup contents changed'
    )
}

export function backupCampaignData(
  paths: LocalInstallationPaths,
  nextBuild: BuildInfo,
  previousBuild: unknown,
  sourceDatabases: readonly PreflightDatabase[],
  now: () => Date
): { readonly path: string; readonly manifestSha256: string } | undefined {
  if (!directoryHasEntries(paths.campaignData)) return undefined
  mkdirSync(paths.backups, { recursive: true })
  const token = randomUUID()
  const staging = join(paths.backups, `.staging-${token}`)
  const timestamp = now().toISOString().replaceAll(/[:.]/g, '-')
  const target = join(
    paths.backups,
    `${timestamp}-${shortBuildFingerprint(nextBuild)}-${token.slice(0, 8)}`
  )
  try {
    const sourceHashes = copyTreeWithHashes(paths.campaignData, staging)
    if (JSON.stringify(hashTree(staging)) !== JSON.stringify(sourceHashes))
      throw new Error('Backup hashes differ from campaign data')
    const copiedDatabases = sourceDatabases.map((database) =>
      join(staging, relative(paths.campaignData, database.path))
    )
    validateDatabases(copiedDatabases)
    // Opening a copied WAL database read-only may create SQLite sidecars in
    // the backup. They are validation artifacts, not source bytes. Remove only
    // paths absent from the source inventory, then prove exact equality again.
    const sourcePaths = new Set(sourceHashes.map(({ path }) => path))
    for (const file of hashTree(staging))
      if (!sourcePaths.has(file.path))
        rmSync(join(staging, ...file.path.split('/')), { force: true })
    if (JSON.stringify(hashTree(staging)) !== JSON.stringify(sourceHashes))
      throw new Error('Database validation changed verified backup bytes')
    const backupManifestPath = join(staging, 'backup-manifest.json')
    writeFileSync(
      backupManifestPath,
      `${JSON.stringify(
        {
          formatVersion: localPersistenceFormatVersions.campaignBackupManifest,
          createdAt: now().toISOString(),
          previousBuild,
          nextBuild,
          databases: sourceDatabases.map((database) => ({
            path: relative(paths.campaignData, database.path)
              .split(sep)
              .join('/'),
            role: database.role,
            schemaVersion: database.schemaVersion,
            expectedVersion: database.expectedVersion
          })),
          files: sourceHashes
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    renameSync(staging, target)
    return {
      path: target,
      manifestSha256: sha256File(join(target, 'backup-manifest.json'))
    }
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    if (error instanceof LocalInstallationError) throw error
    throw new LocalInstallationError(
      'data-corrupt',
      'Campaign data could not be backed up and verified',
      { cause: error }
    )
  }
}

function validateDatabases(paths: readonly string[]): void {
  for (const path of paths) {
    let database: Database.Database | undefined
    try {
      database = new Database(path, { readonly: true, fileMustExist: true })
      const check = database.pragma('quick_check') as Array<
        Record<string, unknown>
      >
      if (
        check.length !== 1 ||
        Object.values(check[0] ?? {}).length !== 1 ||
        Object.values(check[0] ?? {})[0] !== 'ok'
      )
        throw new Error(`SQLite quick_check failed for ${path}`)
    } catch (error) {
      throw new LocalInstallationError(
        'data-corrupt',
        `Campaign database failed SQLite quick_check: ${path}`,
        { cause: error }
      )
    } finally {
      database?.close()
    }
  }
}
