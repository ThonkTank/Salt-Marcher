import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  sqliteOwnedBackupInventory
} from './campaign-file-inventory.js'

export function campaignDataHash(paths: LocalInstallationPaths): string {
  if (!directoryHasEntries(paths.campaignData)) return hashFileInventory([])
  const snapshot = join(tmpdir(), `salt-marcher-backup-hash-${randomUUID()}`)
  try {
    return hashFileInventory(snapshotCampaignData(paths.campaignData, snapshot))
  } catch (error) {
    if (error instanceof LocalInstallationError) throw error
    throw new LocalInstallationError(
      'data-corrupt',
      'Campaign data could not be fingerprinted through SQLite snapshots',
      { cause: error }
    )
  } finally {
    rmSync(snapshot, { recursive: true, force: true })
  }
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
      snapshotMethod: z.literal('sqlite-online-backup'),
      sourceDataHash: z.string().regex(/^[a-f0-9]{64}$/),
      databases: z.array(z.object({ path: z.string().min(1) }).passthrough()),
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
  const actualFiles = sqliteOwnedBackupInventory(
    hashTree(journal.backupPath).filter(
      ({ path }) => path !== 'backup-manifest.json'
    ),
    backupManifest.databases.map(({ path }) => path)
  )
  if (
    backupManifest.sourceDataHash !== journal.sourceDataHash ||
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
):
  | {
      readonly path: string
      readonly manifestSha256: string
      readonly sourceDataHash: string
    }
  | undefined {
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
    const databasePaths = sourceDatabases.map(({ path }) => path)
    snapshotCampaignDataWithDatabases(
      paths.campaignData,
      staging,
      databasePaths
    )
    const copiedDatabases = sourceDatabases.map((database) =>
      join(staging, relative(paths.campaignData, database.path))
    )
    validateDatabases(copiedDatabases)
    removeDatabaseSidecars(copiedDatabases)
    const sourceHashes = hashTree(staging)
    const sourceDataHash = hashFileInventory(sourceHashes)
    const backupManifestPath = join(staging, 'backup-manifest.json')
    writeFileSync(
      backupManifestPath,
      `${JSON.stringify(
        {
          formatVersion: localPersistenceFormatVersions.campaignBackupManifest,
          snapshotMethod: 'sqlite-online-backup',
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
          sourceDataHash,
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
      manifestSha256: sha256File(join(target, 'backup-manifest.json')),
      sourceDataHash
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

function removeDatabaseSidecars(databasePaths: readonly string[]): void {
  for (const databasePath of databasePaths)
    for (const suffix of ['-wal', '-shm'])
      rmSync(`${databasePath}${suffix}`, { force: true })
}

export function snapshotCampaignData(
  sourceRoot: string,
  targetRoot: string
): ReturnType<typeof hashTree> {
  return snapshotCampaignDataWithDatabases(
    sourceRoot,
    targetRoot,
    sqliteDatabasePaths(sourceRoot)
  )
}

function snapshotCampaignDataWithDatabases(
  sourceRoot: string,
  targetRoot: string,
  databasePaths: readonly string[]
): ReturnType<typeof hashTree> {
  const owned = new Set(
    databasePaths.flatMap((path) => {
      const relativePath = relative(sourceRoot, path).split(sep).join('/')
      return [relativePath, `${relativePath}-wal`, `${relativePath}-shm`]
    })
  )
  copyTreeWithHashes(sourceRoot, targetRoot, (path) => !owned.has(path))
  for (const source of databasePaths) {
    const destination = join(targetRoot, relative(sourceRoot, source))
    mkdirSync(dirname(destination), { recursive: true })
    onlineBackupDatabase(source, destination)
  }
  return hashTree(targetRoot)
}

function onlineBackupDatabase(source: string, destination: string): void {
  const worker = fileURLToPath(
    new URL('../sqlite-online-backup-worker.ts', import.meta.url)
  )
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', worker, source, destination],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `SQLite online backup failed for ${source}: ${result.stderr.trim() || `exit ${result.status}`}`
    )
}

function sqliteDatabasePaths(root: string): string[] {
  if (!existsSync(root)) return []
  const paths: string[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink())
        throw new LocalInstallationError(
          'data-corrupt',
          `Campaign data must not contain symbolic links: ${path}`
        )
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && entry.name.endsWith('.sqlite'))
        paths.push(path)
    }
  }
  visit(root)
  return paths.sort((left, right) => left.localeCompare(right, 'en'))
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
