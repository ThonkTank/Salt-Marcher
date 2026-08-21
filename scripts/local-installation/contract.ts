import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import {
  localArtifactManifestSchema,
  type BuildInfo,
  type LocalArtifactManifest
} from '../../src/shared/contracts/build-info.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import {
  readWorkspaceIdentity,
  type WorkspaceIdentity
} from '../build-identity.js'
import { sha256File } from '../file-hash.js'
import type { LocalInstallJournal } from '../local-install-journal.js'
import { z } from 'zod'

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
  readonly schemaMigrations?: readonly import('../../src/core/persistence/sqlite/schema-migrations.js').SchemaMigration[]
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

export interface InstallationReplacement {
  readonly target: string
  readonly source?: string
  readonly content?: string
  readonly symlinkTarget?: string
  readonly mode?: number
}

export const localInstallationTargets = [
  'backup-created',
  'deployment-staged',
  'activated'
] as const
export type LocalInstallationTarget = (typeof localInstallationTargets)[number]

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

export function readInstallationArtifact(
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

export function assertArtifactMatchesWorkspace(
  options: InstallLocalAppOptions,
  manifest: LocalArtifactManifest
): void {
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
}

export function installationResult(
  paths: LocalInstallationPaths,
  manifest: LocalArtifactManifest,
  journal: LocalInstallJournal
): LocalInstallationResult {
  return {
    paths,
    build: manifest.receipt.build,
    backupPath: journal.backupPath ?? undefined,
    sourceDataHash:
      journal.sourceDataHash ??
      createHash('sha256').update(JSON.stringify([])).digest('hex'),
    backupManifestSha256: journal.backupManifestSha256 ?? undefined,
    deploymentPath: journal.deploymentPath ?? undefined,
    deploymentManifestSha256: journal.deploymentManifestSha256 ?? undefined,
    installedSha256:
      journal.phase === 'completed' ? sha256File(paths.appImage) : undefined
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

export function readPreviousInstalledBuild(path: string): unknown {
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
