import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { durableJson } from '../../src/shared/maintenance/files.js'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  buildInfoSchema,
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
  const payload = backupPayload(journal.backupPath)
  if (payload !== journal.backupPath)
    new ProfileMaintenance(paths.root, 'Local').backupSource(
      basename(journal.backupPath)
    )
  const actualFiles = sqliteOwnedBackupInventory(
    hashTree(payload).filter(
      ({ path }) =>
        payload !== journal.backupPath || path !== 'backup-manifest.json'
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
  const worker = fileURLToPath(
    new URL('../profile-backup-worker.ts', import.meta.url)
  )
  const previousIdentity = buildInfoSchema.safeParse(previousBuild)
  const sourceBuild = previousIdentity.success
    ? previousIdentity.data.commit
    : 'unknown'
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', worker, paths.root, `Local ${sourceBuild}`],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new LocalInstallationError(
      'data-corrupt',
      `Profile backup failed: ${result.stderr.trim()}`
    )
  const { id } = z
    .object({ id: z.uuid() })
    .strict()
    .parse(JSON.parse(result.stdout))
  const target = join(paths.backups, id)
  try {
    const sourceHashes = hashTree(backupPayload(target))
    const sourceDataHash = hashFileInventory(sourceHashes)
    const backupManifestPath = join(target, 'backup-manifest.json')
    durableJson(backupManifestPath, {
      formatVersion: localPersistenceFormatVersions.campaignBackupManifest,
      snapshotMethod: 'sqlite-online-backup',
      createdAt: now().toISOString(),
      previousBuild,
      nextBuild,
      databases: sourceDatabases.map((database) => ({
        path: relative(paths.campaignData, database.path).split(sep).join('/'),
        role: database.role,
        schemaVersion: database.schemaVersion,
        expectedVersion: database.expectedVersion
      })),
      sourceDataHash,
      files: sourceHashes
    })

    return {
      path: target,
      manifestSha256: sha256File(join(target, 'backup-manifest.json')),
      sourceDataHash
    }
  } catch (error) {
    if (error instanceof LocalInstallationError) throw error
    throw new LocalInstallationError(
      'data-corrupt',
      'Campaign data could not be backed up and verified',
      { cause: error }
    )
  }
}

/** Legacy checkpoints stored data alongside their proof; new backups isolate it. */
export function backupPayload(backup: string): string {
  return z.uuid().safeParse(basename(backup)).success &&
    existsSync(join(backup, 'manifest.json'))
    ? join(backup, 'data')
    : backup
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
