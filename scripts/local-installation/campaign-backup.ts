import { profileBackupSchema } from '../../src/shared/contracts/profile-backup.js'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import {
  durableJson,
  inventory,
  directoryInventory
} from '../../src/shared/maintenance/files.js'
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
import { createHash, randomUUID } from 'node:crypto'
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
  hashTreeOrEmpty,
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
  validateBackupContents(paths, journal)
  const activated = readActivatedCheckpoint(paths, journal)
  if (activated) {
    if (activated.profileHash !== fullProfileHash(paths))
      throw new LocalInstallationError(
        'data-corrupt',
        'Activated profile changed after the verified checkpoint'
      )
    return
  }
  if (journal.backupPath) {
    const proof = z
      .object({ sourceProfile: z.unknown().optional() })
      .passthrough()
      .parse(
        JSON.parse(
          readFileSync(join(journal.backupPath, 'backup-manifest.json'), 'utf8')
        )
      )
    if (
      proof.sourceProfile !== undefined &&
      JSON.stringify(proof.sourceProfile) !==
        JSON.stringify(profileCheckpoint(paths.profile))
    )
      throw new LocalInstallationError(
        'data-corrupt',
        'Profile files changed after the verified backup checkpoint'
      )
  }
}

const activatedProfileCheckpointSchema = z
  .object({
    formatVersion: z.literal(1),
    transactionId: z.uuid(),
    artifactSha256: z.string().nullable(),
    backupManifestSha256: z.string().nullable(),
    profileHash: z.string().regex(/^[a-f0-9]{64}$/)
  })
  .strict()

function readActivatedCheckpoint(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal
) {
  const path = join(paths.root, 'activated-profile-checkpoint.json')
  if (!existsSync(path)) return null
  const parsed = activatedProfileCheckpointSchema.safeParse(
    JSON.parse(readFileSync(path, 'utf8'))
  )
  if (
    !parsed.success ||
    parsed.data.transactionId !== journal.transactionId ||
    parsed.data.artifactSha256 !== journal.artifactSha256 ||
    parsed.data.backupManifestSha256 !== journal.backupManifestSha256
  )
    return null
  return parsed.data
}

export function writeActivatedProfileCheckpoint(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal
): void {
  durableJson(
    join(paths.root, 'activated-profile-checkpoint.json'),
    activatedProfileCheckpointSchema.parse({
      formatVersion: 1,
      transactionId: journal.transactionId,
      artifactSha256: journal.artifactSha256,
      backupManifestSha256: journal.backupManifestSha256,
      profileHash: fullProfileHash(paths)
    })
  )
}

function fullProfileHash(paths: LocalInstallationPaths): string {
  const content = profileCheckpoint(paths.profile)
  const files = content.files.filter(
    (file) =>
      !['campaign-data/', 'development-data/'].some((prefix) =>
        file.path.startsWith(prefix)
      )
  )
  const value = {
    files,
    directories: content.directories,
    campaign: campaignDataHash(paths),
    development: campaignDataHash({
      ...paths,
      campaignData: join(paths.profile, 'development-data')
    })
  }
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

/** Validates retained evidence independently from the now-promoted live profile. */
export function validateBackupContents(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal
): void {
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
    hashTreeOrEmpty(payload).filter(
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
  if (!directoryHasEntries(paths.profile)) return undefined
  const sourceProfile = profileCheckpoint(paths.profile)
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
    if (
      JSON.stringify(sourceProfile) !==
      JSON.stringify(profileCheckpoint(paths.profile))
    )
      throw new Error('Profile changed during backup')
    const sourceHashes = hashTreeOrEmpty(backupPayload(target))
    const sourceDataHash = hashFileInventory(sourceHashes)
    const backupManifestPath = join(target, 'backup-manifest.json')
    durableJson(backupManifestPath, {
      formatVersion: localPersistenceFormatVersions.campaignBackupManifest,
      snapshotMethod: 'sqlite-online-backup',
      sourceProfile,
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
  const complete = completeBackupPayload(backup)
  if (complete) return join(complete, 'campaign-data')
  return z.uuid().safeParse(basename(backup)).success &&
    existsSync(join(backup, 'manifest.json'))
    ? join(backup, 'data')
    : backup
}

export function completeBackupPayload(backup: string): string | undefined {
  if (!existsSync(join(backup, 'manifest.json'))) return undefined
  const manifest = profileBackupSchema.parse(
    JSON.parse(readFileSync(join(backup, 'manifest.json'), 'utf8'))
  )
  return manifest.formatVersion === 2 ? join(backup, 'data') : undefined
}

function profileCheckpoint(profile: string) {
  return { files: inventory(profile), directories: directoryInventory(profile) }
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
