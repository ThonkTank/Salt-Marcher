import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  statSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'node:path'
import Database from 'better-sqlite3'
import { z } from 'zod'
import {
  localArtifactManifestSchema,
  shortBuildFingerprint,
  type BuildInfo,
  type LocalArtifactManifest
} from '../src/shared/contracts/build-info.js'
import {
  readWorkspaceIdentity,
  type WorkspaceIdentity
} from './build-identity.js'
import { sha256File } from './file-hash.js'
import {
  CorruptDataError,
  configureSqlite,
  databaseSchemaVersions,
  IncompatibleDataError
} from '../src/core/persistence/sqlite/database.js'
import {
  preflightPersistence,
  type PreflightDatabase,
  type PersistencePreflight
} from '../src/core/persistence/sqlite/persistence-preflight.js'
import {
  applySchemaMigrations,
  schemaMigrations,
  type SchemaMigration
} from '../src/core/persistence/sqlite/schema-migrations.js'
import {
  acquireProfileLock,
  ProfileLockedError
} from '../src/main/local-profile/local-profile-lock.js'
import {
  createInstallJournal,
  readInstallJournal,
  writeInstallJournal,
  type JournalReplacement,
  type LocalInstallJournal
} from './local-install-journal.js'

export type LocalInstallationFailure =
  | 'artifact-invalid'
  | 'stale-build'
  | 'app-running'
  | 'installation-locked'
  | 'data-corrupt'
  | 'migration-missing'
  | 'migration-failed'
  | 'atomic-replace-failed'

export class LocalInstallationError extends Error {
  override readonly name = 'LocalInstallationError'

  constructor(
    readonly code: LocalInstallationFailure,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}

/** Test-only abrupt-termination seam; production never constructs this. */
export class LocalInstallCrashForTest extends Error {
  override readonly name = 'LocalInstallCrashForTest'
}

export interface LocalInstallationPaths {
  readonly root: string
  readonly deployments: string
  readonly current: string
  readonly lock: string
  readonly journal: string
  readonly appImage: string
  readonly profile: string
  readonly campaignData: string
  readonly backups: string
  readonly installedManifest: string
  readonly desktopEntry: string
  readonly icon: string
}

export interface InstallLocalAppOptions {
  readonly workspaceRoot: string
  readonly xdgDataHome: string
  readonly artifactPath: string
  readonly artifactManifestPath: string
  readonly iconSourcePath: string
  readonly readWorkspaceIdentity?: (root: string) => WorkspaceIdentity
  readonly isAppRunning?: (appImagePath: string) => boolean
  readonly now?: () => Date
  /** Test seam for a failed promotion. Rollback always uses native rename. */
  readonly renameForInstall?: (source: string, target: string) => void
  readonly schemaMigrations?: readonly SchemaMigration[]
  readonly afterJournalWriteForTest?: (journal: LocalInstallJournal) => void
}

export interface LocalInstallationResult {
  readonly paths: LocalInstallationPaths
  readonly build: BuildInfo
  readonly backupPath: string | undefined
  readonly sourceDataHash: string
  readonly backupManifestSha256: string | undefined
  readonly deploymentPath: string | undefined
  readonly deploymentManifestSha256: string | undefined
  readonly installedSha256: string | undefined
}

export const localInstallationTargets = [
  'backup-created',
  'deployment-staged',
  'activated'
] as const
export type LocalInstallationTarget = (typeof localInstallationTargets)[number]

interface FileHash {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

interface Replacement {
  readonly target: string
  readonly source?: string
  readonly content?: string
  readonly symlinkTarget?: string
  readonly mode?: number
}

export function localInstallationPaths(
  xdgDataHome: string
): LocalInstallationPaths {
  const root = resolve(xdgDataHome, 'salt-marcher-local')
  const profile = join(root, 'profile')
  const deployments = join(root, 'deployments')
  const current = join(root, 'current')
  return {
    root,
    deployments,
    current,
    lock: join(root, 'runtime.lock'),
    journal: join(root, 'install-journal.json'),
    appImage: join(current, 'SaltMarcher.AppImage'),
    profile,
    campaignData: join(profile, 'campaign-data'),
    backups: join(root, 'backups'),
    installedManifest: join(current, 'artifact-manifest.json'),
    desktopEntry: join(
      xdgDataHome,
      'applications',
      'org.saltmarcher.local.desktop'
    ),
    icon: join(
      xdgDataHome,
      'icons',
      'hicolor',
      '256x256',
      'apps',
      'org.saltmarcher.local.png'
    )
  }
}

export function installLocalApp(
  options: InstallLocalAppOptions
): LocalInstallationResult {
  return advanceLocalAppInstallation(options, 'activated')
}

export function advanceLocalAppInstallation(
  options: InstallLocalAppOptions,
  target: LocalInstallationTarget
): LocalInstallationResult {
  const paths = localInstallationPaths(options.xdgDataHome)
  const manifest = readArtifactManifest(options)
  const workspaceIdentity = (
    options.readWorkspaceIdentity ?? readWorkspaceIdentity
  )(options.workspaceRoot)
  const build = manifest.receipt.build
  if (
    build.workspaceFingerprint !== workspaceIdentity.workspaceFingerprint ||
    build.appBuildInputFingerprint !==
      workspaceIdentity.appBuildInputFingerprint ||
    build.commit !== workspaceIdentity.commit ||
    build.dirty !== workspaceIdentity.dirty
  )
    throw new LocalInstallationError(
      'stale-build',
      'The AppImage source fingerprint does not match the current workspace'
    )
  mkdirSync(paths.root, { recursive: true })
  return withInstallationLock(paths, () =>
    advanceLocalAppInstallationLocked(options, paths, manifest, target)
  )
}

function advanceLocalAppInstallationLocked(
  options: InstallLocalAppOptions,
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  target: LocalInstallationTarget
): LocalInstallationResult {
  if ((options.isAppRunning ?? isInstalledLocalAppRunning)(paths.appImage))
    throw new LocalInstallationError(
      'app-running',
      'SaltMarcher Local is still running; close it before installation'
    )

  const now = options.now ?? (() => new Date())
  let journal = readInstallJournal(paths.journal)
  const matches = (candidate: LocalInstallJournal | null): boolean =>
    candidate?.applicationSha === manifest.receipt.build.commit &&
    candidate.buildFingerprint ===
      manifest.receipt.build.workspaceFingerprint &&
    candidate.appBuildInputFingerprint ===
      manifest.receipt.build.appBuildInputFingerprint &&
    candidate.artifactSha256 === manifest.artifactSha256
  if (
    journal !== null &&
    (!matches(journal) ||
      !['backup-complete', 'deployment-staged', 'completed'].includes(
        journal.phase
      ))
  ) {
    recoverInterruptedInstallation(paths, options.schemaMigrations, now)
    journal = readInstallJournal(paths.journal)
  }
  if (matches(journal) && journal !== null)
    try {
      if (journal.phase === 'backup-complete')
        validateBackupCheckpoint(paths, journal)
      if (journal.phase === 'deployment-staged') {
        validateBackupCheckpoint(paths, journal)
        validateDeploymentCheckpoint(paths, manifest, options, journal)
      }
      if (journal.phase === 'completed') {
        validateBackupCheckpoint(paths, journal)
        validateDeploymentCheckpoint(paths, manifest, options, journal)
        try {
          validateCompletedInstallation(paths, manifest, options.iconSourcePath)
        } catch {
          journal = writeInstallJournal(
            paths.journal,
            { ...journal, phase: 'deployment-staged', replacements: [] },
            now
          )
        }
      }
    } catch {
      journal = writeInstallJournal(
        paths.journal,
        { ...journal, phase: 'rolled-back' },
        now
      )
    }
  if (!matches(journal) || journal?.phase === 'rolled-back') {
    journal = writeInstallJournal(
      paths.journal,
      createInstallJournal(
        {
          applicationSha: manifest.receipt.build.commit,
          buildFingerprint: manifest.receipt.build.workspaceFingerprint,
          appBuildInputFingerprint:
            manifest.receipt.build.appBuildInputFingerprint,
          artifactSha256: manifest.artifactSha256
        },
        now
      ),
      now
    )
    options.afterJournalWriteForTest?.(journal)
  }
  if (journal === null) throw new Error('Installation journal was not created')
  let activeJournal: LocalInstallJournal = journal
  const updateJournal = (
    changes: Partial<
      Omit<LocalInstallJournal, 'formatVersion' | 'transactionId'>
    >
  ): void => {
    activeJournal = writeInstallJournal(
      paths.journal,
      { ...activeJournal, ...changes },
      now
    )
    options.afterJournalWriteForTest?.(activeJournal)
  }
  try {
    if (activeJournal.phase === 'completed') {
      validateCompletedInstallation(paths, manifest, options.iconSourcePath)
      return installationResult(paths, manifest, activeJournal)
    }

    if (activeJournal.phase === 'prepared') {
      const preflight = readPersistencePreflight(
        paths,
        options.schemaMigrations
      )
      const sourceDataHash = hashFileInventory(
        hashTreeOrEmpty(paths.campaignData)
      )
      const backup = backupCampaignData(
        paths,
        manifest.receipt.build,
        preflight.databases,
        now
      )
      updateJournal({
        phase: 'backup-complete',
        backupPath: backup?.path ?? null,
        sourceDataHash,
        campaignDataHash: sourceDataHash,
        backupManifestSha256: backup?.manifestSha256 ?? null
      })
    } else validateBackupCheckpoint(paths, activeJournal)

    if (target === 'backup-created')
      return installationResult(paths, manifest, activeJournal)

    if (activeJournal.phase === 'backup-complete') {
      const deployment = stageDeployment(paths, manifest, options)
      updateJournal({
        phase: 'deployment-staged',
        deploymentPath: deployment,
        deploymentManifestSha256: sha256File(
          join(deployment, 'artifact-manifest.json')
        )
      })
    } else validateDeploymentCheckpoint(paths, manifest, options, activeJournal)

    if (target === 'deployment-staged')
      return installationResult(paths, manifest, activeJournal)

    validateBackupCheckpoint(paths, activeJournal)
    const preflight = readPersistencePreflight(paths, options.schemaMigrations)
    if (preflight.kind === 'migration-required')
      migrateCampaignData(
        paths,
        preflight,
        options.schemaMigrations ?? schemaMigrations,
        updateJournal
      )

    const deployment = activeJournal.deploymentPath
    if (deployment === null)
      throw new Error('Installation journal has no staged deployment')
    const desktopEntry = renderDesktopEntry(paths, manifest.receipt.build)
    replaceAtomically(
      [
        {
          target: paths.icon,
          source: options.iconSourcePath,
          mode: 0o644
        },
        {
          target: paths.desktopEntry,
          content: desktopEntry,
          mode: 0o644
        },
        {
          target: paths.current,
          symlinkTarget: relative(paths.root, deployment)
        }
      ],
      options.renameForInstall ?? renameSync,
      updateJournal
    )
    mkdirSync(paths.profile, { recursive: true })
    updateJournal({ phase: 'completed' })
    validateCompletedInstallation(paths, manifest, options.iconSourcePath)
    return installationResult(paths, manifest, activeJournal)
  } catch (error) {
    if (error instanceof LocalInstallCrashForTest) throw error
    recoverInterruptedInstallation(paths, options.schemaMigrations, now)
    if (error instanceof LocalInstallationError) throw error
    throw new LocalInstallationError(
      'atomic-replace-failed',
      'The local application could not be replaced; the previous installation was restored',
      { cause: error }
    )
  }
}

export function inspectLocalAppInstallation(
  options: InstallLocalAppOptions,
  target: LocalInstallationTarget
): LocalInstallationResult | null {
  try {
    const paths = localInstallationPaths(options.xdgDataHome)
    const manifest = readArtifactManifest(options)
    const journal = readInstallJournal(paths.journal)
    if (
      journal === null ||
      journal.applicationSha !== manifest.receipt.build.commit ||
      journal.buildFingerprint !==
        manifest.receipt.build.workspaceFingerprint ||
      journal.appBuildInputFingerprint !==
        manifest.receipt.build.appBuildInputFingerprint ||
      journal.artifactSha256 !== manifest.artifactSha256
    )
      return null
    validateBackupCheckpoint(paths, journal)
    if (target !== 'backup-created')
      validateDeploymentCheckpoint(paths, manifest, options, journal)
    if (target === 'activated') {
      if (journal.phase !== 'completed') return null
      validateCompletedInstallation(paths, manifest, options.iconSourcePath)
    } else if (
      target === 'deployment-staged' &&
      !['deployment-staged', 'completed'].includes(journal.phase)
    )
      return null
    else if (
      target === 'backup-created' &&
      !['backup-complete', 'deployment-staged', 'completed'].includes(
        journal.phase
      )
    )
      return null
    return installationResult(paths, manifest, journal)
  } catch {
    return null
  }
}

function readPersistencePreflight(
  paths: LocalInstallationPaths,
  migrations?: readonly SchemaMigration[]
): PersistencePreflight {
  try {
    return preflightPersistence(paths.campaignData, migrations)
  } catch (error) {
    if (error instanceof IncompatibleDataError)
      throw new LocalInstallationError(
        'migration-missing',
        `No tested migration exists from schema ${String(error.actualVersion)} to ${error.expectedVersion}`,
        { cause: error }
      )
    if (error instanceof CorruptDataError)
      throw new LocalInstallationError(
        'data-corrupt',
        `Campaign database failed SQLite quick_check: ${error.dataPath}`,
        { cause: error }
      )
    throw error
  }
}

function validateBackupCheckpoint(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal
): void {
  const currentHash = hashFileInventory(hashTreeOrEmpty(paths.campaignData))
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
    .parse(JSON.parse(readFileSync(manifestPath, 'utf8')))
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

function validateDeploymentCheckpoint(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  options: InstallLocalAppOptions,
  journal: LocalInstallJournal
): void {
  if (journal.deploymentPath === null)
    throw new Error('Installation journal has no staged deployment')
  validateDeployment(journal.deploymentPath, manifest, options.iconSourcePath)
  const manifestHash = sha256File(
    join(journal.deploymentPath, 'artifact-manifest.json')
  )
  if (journal.deploymentManifestSha256 !== manifestHash)
    throw new Error('Staged deployment manifest hash changed')
  const relativeDeployment = relative(paths.deployments, journal.deploymentPath)
  if (
    relativeDeployment === '' ||
    relativeDeployment.startsWith(`..${sep}`) ||
    relativeDeployment === '..' ||
    isAbsolute(relativeDeployment)
  )
    throw new Error('Staged deployment escaped the deployment root')
}

function validateCompletedInstallation(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  iconSourcePath: string
): void {
  const deployment = join(
    paths.deployments,
    manifest.receipt.build.workspaceFingerprint
  )
  validateDeployment(deployment, manifest, iconSourcePath)
  if (!currentSelectsDeployment(paths.current, deployment))
    throw new Error(
      'Current installation does not select the staged deployment'
    )
  if (sha256File(paths.appImage) !== manifest.artifactSha256)
    throw new Error('Activated AppImage hash differs from its artifact')
  if (sha256File(paths.icon) !== sha256File(iconSourcePath))
    throw new Error('Activated desktop icon differs from its source')
  if (
    readFileSync(paths.desktopEntry, 'utf8') !==
    renderDesktopEntry(paths, manifest.receipt.build)
  )
    throw new Error('Activated desktop entry differs from its build')
}

function installationResult(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  journal: LocalInstallJournal
): LocalInstallationResult {
  return {
    paths,
    build: manifest.receipt.build,
    backupPath: journal.backupPath ?? undefined,
    sourceDataHash: journal.sourceDataHash ?? hashFileInventory([]),
    backupManifestSha256: journal.backupManifestSha256 ?? undefined,
    deploymentPath: journal.deploymentPath ?? undefined,
    deploymentManifestSha256: journal.deploymentManifestSha256 ?? undefined,
    installedSha256:
      journal.phase === 'completed' ? sha256File(paths.appImage) : undefined
  }
}

function readArtifactManifest(
  options: InstallLocalAppOptions
): LocalArtifactManifest {
  try {
    const manifest = localArtifactManifestSchema.parse(
      JSON.parse(readFileSync(options.artifactManifestPath, 'utf8'))
    )
    if (manifest.receipt.build.channel !== 'local')
      throw new Error('Artifact is not from the local channel')
    if (
      manifest.receipt.build.schemaVersions.installation !==
        databaseSchemaVersions.installation ||
      manifest.receipt.build.schemaVersions.campaign !==
        databaseSchemaVersions.campaign
    )
      throw new Error('Artifact schema does not match this installer')
    if (
      createHash('sha256')
        .update(JSON.stringify(manifest.receipt))
        .digest('hex') !== manifest.receiptSha256
    )
      throw new Error('Artifact receipt hash does not match its manifest')
    if (manifest.artifactFile !== basename(options.artifactPath))
      throw new Error('Artifact filename does not match its manifest')
    if (sha256File(options.artifactPath) !== manifest.artifactSha256)
      throw new Error('Artifact hash does not match its manifest')
    return manifest
  } catch (error) {
    throw new LocalInstallationError(
      'artifact-invalid',
      'The local AppImage or its manifest is invalid',
      { cause: error }
    )
  }
}

function withInstallationLock<T>(
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

function recoverInterruptedInstallation(
  paths: LocalInstallationPaths,
  migrations: readonly SchemaMigration[] = schemaMigrations,
  now: () => Date = () => new Date()
): void {
  const journal = readInstallJournal(paths.journal)
  if (
    journal === null ||
    journal.phase === 'completed' ||
    journal.phase === 'rolled-back'
  )
    return

  const migration = journal.migration
  if (migration !== null) {
    const dataWasCommitted = phaseAtLeast(journal.phase, 'data-promoted')
    if (existsSync(migration.rollback)) {
      if (
        dataWasCommitted &&
        persistenceIsReady(paths.campaignData, migrations)
      )
        rmSync(migration.rollback, { recursive: true, force: true })
      else {
        rmSync(paths.campaignData, { recursive: true, force: true })
        renameSync(migration.rollback, paths.campaignData)
      }
    }
    rmSync(migration.staging, { recursive: true, force: true })
  }

  let recovered: LocalInstallJournal
  if (journal.replacements.length > 0) {
    const committed =
      journal.deploymentPath !== null &&
      currentSelectsDeployment(paths.current, journal.deploymentPath)
    if (committed && replacementsArePresent(journal.replacements)) {
      cleanupReplacementDebris(journal.replacements)
      recovered = { ...journal, phase: 'completed' }
    } else {
      rollbackReplacements(journal.replacements)
      recovered = {
        ...journal,
        phase:
          journal.deploymentPath === null ? 'rolled-back' : 'deployment-staged',
        replacements: []
      }
    }
  } else {
    recovered = {
      ...journal,
      phase:
        journal.deploymentPath === null ? 'rolled-back' : 'deployment-staged',
      campaignDataHash: hashFileInventory(hashTreeOrEmpty(paths.campaignData)),
      migration: null,
      replacements: []
    }
  }
  writeInstallJournal(paths.journal, recovered, now)
}

function migrateCampaignData(
  paths: LocalInstallationPaths,
  preflight: Extract<PersistencePreflight, { kind: 'migration-required' }>,
  migrations: readonly SchemaMigration[],
  updateJournal: (
    changes: Partial<
      Omit<LocalInstallJournal, 'formatVersion' | 'transactionId'>
    >
  ) => void
): void {
  const staging = join(paths.profile, '.campaign-data.migration')
  const rollback = join(paths.profile, '.campaign-data.rollback')
  try {
    cpSync(paths.campaignData, staging, {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true
    })
    updateJournal({
      phase: 'migration-staged',
      migration: { staging, rollback }
    })
    for (const source of preflight.databases) {
      if (source.schemaVersion === source.expectedVersion) continue
      const path = join(staging, relative(paths.campaignData, source.path))
      const database = new Database(path)
      try {
        configureSqlite(database)
        applySchemaMigrations(database, { path, role: source.role }, migrations)
      } finally {
        database.close()
      }
    }
    if (preflightPersistence(staging, migrations).kind !== 'ready')
      throw new Error('Migrated persistence did not reach the current schema')
    renameSync(paths.campaignData, rollback)
    updateJournal({ phase: 'data-rollback-created' })
    try {
      renameSync(staging, paths.campaignData)
      if (preflightPersistence(paths.campaignData, migrations).kind !== 'ready')
        throw new Error('Promoted persistence failed validation')
      updateJournal({ phase: 'data-promoted' })
      updateJournal({
        campaignDataHash: hashFileInventory(hashTreeOrEmpty(paths.campaignData))
      })
      rmSync(rollback, { recursive: true, force: true })
    } catch (error) {
      rmSync(paths.campaignData, { recursive: true, force: true })
      renameSync(rollback, paths.campaignData)
      throw error
    }
  } catch (error) {
    if (error instanceof LocalInstallCrashForTest) throw error
    rmSync(staging, { recursive: true, force: true })
    throw new LocalInstallationError(
      'migration-failed',
      'Campaign data migration failed; the pre-migration data was restored',
      { cause: error }
    )
  }
}

function stageDeployment(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  options: InstallLocalAppOptions
): string {
  mkdirSync(paths.deployments, { recursive: true })
  const target = join(
    paths.deployments,
    manifest.receipt.build.workspaceFingerprint
  )
  if (existsSync(target)) {
    validateDeployment(target, manifest, options.iconSourcePath)
    return target
  }
  const staging = join(paths.deployments, `.staging-${randomUUID()}`)
  try {
    mkdirSync(staging)
    const appImage = join(staging, 'SaltMarcher.AppImage')
    const icon = join(staging, 'icon.png')
    const artifactManifest = join(staging, 'artifact-manifest.json')
    copyFileSync(options.artifactPath, appImage)
    chmodSync(appImage, 0o755)
    copyFileSync(options.iconSourcePath, icon)
    chmodSync(icon, 0o644)
    writeFileSync(
      artifactManifest,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    )
    chmodSync(artifactManifest, 0o644)
    syncPath(appImage)
    syncPath(icon)
    syncPath(artifactManifest)
    syncPath(staging)
    renameSync(staging, target)
    syncPath(paths.deployments)
    return target
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw new LocalInstallationError(
      'atomic-replace-failed',
      'The versioned application deployment could not be staged',
      { cause: error }
    )
  }
}

function validateDeployment(
  deployment: string,
  manifest: LocalArtifactManifest,
  iconSourcePath: string
): void {
  const storedManifest = localArtifactManifestSchema.parse(
    JSON.parse(readFileSync(join(deployment, 'artifact-manifest.json'), 'utf8'))
  )
  if (
    JSON.stringify(storedManifest) !== JSON.stringify(manifest) ||
    sha256File(join(deployment, 'SaltMarcher.AppImage')) !==
      manifest.artifactSha256 ||
    sha256File(join(deployment, 'icon.png')) !== sha256File(iconSourcePath)
  )
    throw new Error('Existing versioned deployment does not match its build')
}

function syncPath(path: string): void {
  const descriptor = openSync(path, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function validateDatabases(
  paths: readonly string[],
  schemaVersion?: number
): void {
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
      const existingVersion = database.pragma('user_version', {
        simple: true
      })
      if (schemaVersion !== undefined && existingVersion !== schemaVersion)
        throw new LocalInstallationError(
          'migration-missing',
          `No tested migration exists from schema ${String(existingVersion)} to ${schemaVersion}`
        )
    } catch (error) {
      if (error instanceof LocalInstallationError) throw error
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

function backupCampaignData(
  paths: LocalInstallationPaths,
  nextBuild: BuildInfo,
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
    const previousBuild = readPreviousInstalledBuild(paths.installedManifest)
    const backupManifestPath = join(staging, 'backup-manifest.json')
    writeFileSync(
      backupManifestPath,
      `${JSON.stringify(
        {
          formatVersion: 1,
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

const legacyInstalledManifestSchema = z
  .object({
    formatVersion: z.literal(1),
    build: z
      .object({
        channel: z.enum(['development', 'local', 'release']),
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        dirty: z.boolean(),
        builtAt: z.iso.datetime(),
        schemaVersion: z.number().int().nonnegative()
      })
      .strict()
  })
  .passthrough()

function readPreviousInstalledBuild(path: string): unknown {
  if (!existsSync(path)) return null
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  const current = localArtifactManifestSchema.safeParse(value)
  if (current.success) return current.data.receipt.build
  const legacy = legacyInstalledManifestSchema.parse(value).build
  return {
    channel: legacy.channel,
    commit: legacy.commit,
    dirty: legacy.dirty,
    workspaceFingerprint: legacy.sourceFingerprint,
    appBuildInputFingerprint: null,
    builtAt: legacy.builtAt,
    schemaVersions: {
      installation: legacy.schemaVersion,
      campaign: legacy.schemaVersion
    },
    migrationRegistryVersion: null,
    toolchain: null,
    provenanceFormat: 1
  }
}

function replaceAtomically(
  replacements: readonly Replacement[],
  promote: (source: string, target: string) => void,
  updateJournal: (
    changes: Partial<
      Omit<LocalInstallJournal, 'formatVersion' | 'transactionId'>
    >
  ) => void
): void {
  const token = randomUUID()
  const staged = new Map<string, string>()
  const rollback = new Map<string, string>()
  const installed = new Set<string>()
  try {
    for (const replacement of replacements) {
      mkdirSync(dirname(replacement.target), { recursive: true })
      if (
        existsSync(replacement.target) &&
        !lstatSync(replacement.target).isFile() &&
        !lstatSync(replacement.target).isSymbolicLink()
      )
        throw new Error(
          `Installation target is not a file: ${replacement.target}`
        )
      const next = join(
        dirname(replacement.target),
        `.${basename(replacement.target)}.install-${token}`
      )
      if (replacement.symlinkTarget !== undefined)
        symlinkSync(replacement.symlinkTarget, next)
      else if (replacement.source !== undefined)
        copyFileSync(replacement.source, next)
      else writeFileSync(next, replacement.content ?? '', 'utf8')
      if (replacement.symlinkTarget === undefined)
        chmodSync(next, replacement.mode ?? 0o644)
      staged.set(replacement.target, next)
    }
    let journalReplacements: JournalReplacement[] = replacements.map(
      (replacement) => ({
        target: replacement.target,
        staged: staged.get(replacement.target)!,
        rollback: null,
        state: 'staged'
      })
    )
    updateJournal({ phase: 'files-staged', replacements: journalReplacements })
    for (const replacement of replacements) {
      if (!existsSync(replacement.target)) continue
      const previous = join(
        dirname(replacement.target),
        `.${basename(replacement.target)}.rollback-${token}`
      )
      promote(replacement.target, previous)
      rollback.set(replacement.target, previous)
      journalReplacements = journalReplacements.map((entry) =>
        entry.target === replacement.target
          ? { ...entry, rollback: previous, state: 'previous-moved' }
          : entry
      )
      updateJournal({
        phase: 'files-promoting',
        replacements: journalReplacements
      })
    }
    for (const replacement of replacements) {
      promote(staged.get(replacement.target)!, replacement.target)
      installed.add(replacement.target)
      journalReplacements = journalReplacements.map((entry) =>
        entry.target === replacement.target
          ? { ...entry, state: 'promoted' }
          : entry
      )
      updateJournal({
        phase: 'files-promoting',
        replacements: journalReplacements
      })
    }
  } catch (error) {
    for (const target of [...installed].reverse())
      rmSync(target, { force: true })
    for (const [target, previous] of [...rollback].reverse()) {
      if (existsSync(target)) rmSync(target, { force: true })
      if (existsSync(previous)) renameSync(previous, target)
    }
    updateJournal({ phase: 'deployment-staged', replacements: [] })
    throw error
  } finally {
    for (const path of staged.values()) rmSync(path, { force: true })
  }
  for (const previous of rollback.values()) rmSync(previous, { force: true })
}

const installationPhases: readonly LocalInstallJournal['phase'][] = [
  'prepared',
  'backup-complete',
  'migration-staged',
  'data-rollback-created',
  'data-promoted',
  'deployment-staged',
  'files-staged',
  'files-promoting',
  'completed',
  'rolled-back'
]

function phaseAtLeast(
  actual: LocalInstallJournal['phase'],
  expected: LocalInstallJournal['phase']
): boolean {
  return (
    installationPhases.indexOf(actual) >= installationPhases.indexOf(expected)
  )
}

function persistenceIsReady(
  path: string,
  migrations: readonly SchemaMigration[]
): boolean {
  try {
    return preflightPersistence(path, migrations).kind === 'ready'
  } catch {
    return false
  }
}

function currentSelectsDeployment(
  current: string,
  deployment: string
): boolean {
  try {
    return (
      resolve(dirname(current), readlinkSync(current)) === resolve(deployment)
    )
  } catch {
    return false
  }
}

function replacementsArePresent(
  replacements: readonly JournalReplacement[]
): boolean {
  return replacements.every((entry) => existsSync(entry.target))
}

function cleanupReplacementDebris(
  replacements: readonly JournalReplacement[]
): void {
  for (const replacement of replacements) {
    rmSync(replacement.staged, { force: true })
    if (replacement.rollback !== null)
      rmSync(replacement.rollback, { force: true })
  }
}

function rollbackReplacements(
  replacements: readonly JournalReplacement[]
): void {
  for (const replacement of [...replacements].reverse()) {
    const promotedWithoutRecordedState =
      replacement.state !== 'promoted' && !existsSync(replacement.staged)
    if (replacement.rollback !== null && existsSync(replacement.rollback)) {
      rmSync(replacement.target, { force: true })
      renameSync(replacement.rollback, replacement.target)
    } else if (
      replacement.state === 'promoted' ||
      promotedWithoutRecordedState
    ) {
      rmSync(replacement.target, { force: true })
    }
    rmSync(replacement.staged, { force: true })
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

function renderDesktopEntry(
  paths: LocalInstallationPaths,
  build: BuildInfo
): string {
  const fingerprint = shortBuildFingerprint(build)
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=SaltMarcher Local (${fingerprint})`,
    `Comment=Lokaler SaltMarcher-Testbuild ${fingerprint}`,
    `Exec=${desktopQuote(paths.appImage)} --user-data-dir=${desktopQuote(paths.profile)}`,
    `Icon=${paths.icon}`,
    'Terminal=false',
    'Categories=Game;Utility;',
    'StartupNotify=true',
    ''
  ].join('\n')
}

function desktopQuote(value: string): string {
  return '"' + value.replaceAll(/([\\"`$])/g, '\\$1') + '"'
}

function hashTree(root: string): FileHash[] {
  return treeFiles(root).map((path) => ({
    path: relative(root, path).split(sep).join('/'),
    bytes: statSync(path).size,
    sha256: sha256File(path)
  }))
}

function hashTreeOrEmpty(root: string): FileHash[] {
  return existsSync(root) ? hashTree(root) : []
}

function hashFileInventory(files: readonly FileHash[]): string {
  return createHash('sha256').update(JSON.stringify(files)).digest('hex')
}

/** Copies and hashes each source byte in the same pass; verification rereads only the backup. */
function copyTreeWithHashes(
  sourceRoot: string,
  targetRoot: string
): FileHash[] {
  mkdirSync(targetRoot, { recursive: false })
  const hashes: FileHash[] = []
  copyDirectory(sourceRoot, targetRoot, sourceRoot, hashes)
  syncPath(targetRoot)
  return hashes.sort((left, right) => left.path.localeCompare(right.path, 'en'))
}

function copyDirectory(
  sourceDirectory: string,
  targetDirectory: string,
  sourceRoot: string,
  hashes: FileHash[]
): void {
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const source = join(sourceDirectory, entry.name)
    const target = join(targetDirectory, entry.name)
    if (entry.isSymbolicLink())
      throw new LocalInstallationError(
        'data-corrupt',
        `Campaign data must not contain symbolic links: ${source}`
      )
    if (entry.isDirectory()) {
      mkdirSync(target)
      copyDirectory(source, target, sourceRoot, hashes)
      syncPath(target)
      continue
    }
    if (!entry.isFile())
      throw new LocalInstallationError(
        'data-corrupt',
        `Unsupported campaign data entry: ${source}`
      )
    hashes.push(copyFileWithHash(source, target, sourceRoot))
  }
}

function copyFileWithHash(
  source: string,
  target: string,
  sourceRoot: string
): FileHash {
  const before = statSync(source)
  const input = openSync(source, 'r')
  const output = openSync(target, 'wx', before.mode & 0o777)
  const digest = createHash('sha256')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  let bytes = 0
  try {
    for (;;) {
      const count = readSync(input, buffer, 0, buffer.length, null)
      if (count === 0) break
      digest.update(buffer.subarray(0, count))
      let written = 0
      while (written < count)
        written += writeSync(output, buffer, written, count - written)
      bytes += count
    }
    fsyncSync(output)
  } finally {
    closeSync(output)
    closeSync(input)
  }
  const after = statSync(source)
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
    throw new Error(`Campaign data changed while it was copied: ${source}`)
  return {
    path: relative(sourceRoot, source).split(sep).join('/'),
    bytes,
    sha256: digest.digest('hex')
  }
}

function treeFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink())
      throw new LocalInstallationError(
        'data-corrupt',
        `Campaign data must not contain symbolic links: ${path}`
      )
    if (entry.isDirectory()) files.push(...treeFiles(path))
    else if (entry.isFile()) files.push(path)
    else
      throw new LocalInstallationError(
        'data-corrupt',
        `Unsupported campaign data entry: ${path}`
      )
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'))
}

function directoryHasEntries(path: string): boolean {
  return existsSync(path) && readdirSync(path).length > 0
}
