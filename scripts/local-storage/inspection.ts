import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  readdirSync
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { localArtifactManifestSchema } from '../../src/shared/contracts/build-info.js'
import {
  assertCurrentLocalPersistenceVersion,
  localPersistenceFormatVersions
} from '../../src/shared/contracts/local-persistence-format-versions.js'
import { sha256File } from '../file-hash.js'
import { readInstallJournal } from '../local-install-journal.js'
import type { LocalInstallationPaths } from '../local-installation/contract.js'
import { hashTree } from '../local-installation/campaign-file-inventory.js'
import {
  backupBytesWarningThreshold,
  backupCountWarningThreshold,
  deploymentFingerprintPattern,
  minimumBackupAgeMs,
  retainedInactiveDeployments,
  retainedRecentBackups,
  type LocalStorageInspection,
  type StorageFinding,
  type StorageWarning,
  type ValidBackup,
  type ValidDeployment
} from './contract.js'
import { inspectCompatibility } from './compatibility.js'
import { directDirectoryNames, treeBytes } from './filesystem.js'

export interface InspectLocalStorageOptions {
  readonly paths: LocalInstallationPaths
  readonly iconSourcePath: string
  readonly now?: () => Date
  readonly receiptDirectory?: string
}

type InspectedDeployment = Omit<
  ValidDeployment,
  'active' | 'journalProtected' | 'retention'
>

const backupManifestSchema = z
  .object({
    formatVersion: z.literal(
      localPersistenceFormatVersions.campaignBackupManifest
    ),
    createdAt: z.iso.datetime(),
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

export function inspectLocalStorage(
  options: InspectLocalStorageOptions
): LocalStorageInspection {
  const now = options.now ?? (() => new Date())
  const nowMs = now().getTime()
  const findings: StorageFinding[] = []
  const active = activeDeployment(options.paths, findings)
  const journal = protectedDeployments(options.paths, findings)
  const validDeployments: InspectedDeployment[] = []

  for (const name of directDirectoryNames(options.paths.deployments)) {
    const path = join(options.paths.deployments, name)
    try {
      validDeployments.push(
        validateDeploymentDirectory(path, name, options.iconSourcePath)
      )
    } catch (error) {
      findings.push({
        area: 'deployments',
        name,
        reason: errorMessage(error)
      })
    }
  }

  const activeIsValid =
    active !== null &&
    validDeployments.some(({ fingerprint }) => fingerprint === active)
  if (active !== null && !activeIsValid)
    findings.push({
      area: 'deployments',
      name: active,
      reason: 'The active deployment did not pass ownership validation'
    })
  const pruningBlocked = active === null || !activeIsValid || journal.unknown
  const newestInactive = validDeployments
    .filter(({ fingerprint }) => fingerprint !== active)
    .sort(newestFirst)
    .slice(0, retainedInactiveDeployments)
    .map(({ fingerprint }) => fingerprint)
  const retained = new Set([
    ...(active === null ? [] : [active]),
    ...newestInactive,
    ...journal.fingerprints
  ])
  const deployments: ValidDeployment[] = validDeployments
    .sort(newestFirst)
    .map((deployment) => ({
      ...deployment,
      active: deployment.fingerprint === active,
      journalProtected: journal.fingerprints.has(deployment.fingerprint),
      retention:
        pruningBlocked || retained.has(deployment.fingerprint)
          ? 'keep'
          : 'delete'
    }))

  const backupNames = directDirectoryNames(options.paths.backups)
  let backupBytes = 0
  const inspectedBackups: Array<
    Omit<ValidBackup, 'protectedByRecency' | 'protectedByAge' | 'pruneEligible'>
  > = []
  for (const name of backupNames) {
    const path = join(options.paths.backups, name)
    try {
      const bytes = treeBytes(path)
      backupBytes += bytes
      inspectedBackups.push(validateBackupDirectory(path, name, bytes))
    } catch (error) {
      backupBytes += bestEffortBytes(path)
      findings.push({ area: 'backups', name, reason: errorMessage(error) })
    }
  }
  const newestBackups = new Set(
    [...inspectedBackups]
      .sort((left, right) =>
        right.createdAt === left.createdAt
          ? right.name.localeCompare(left.name, 'en')
          : right.createdAt.localeCompare(left.createdAt, 'en')
      )
      .slice(0, retainedRecentBackups)
      .map(({ name }) => name)
  )
  const backups: ValidBackup[] = inspectedBackups
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .map((backup) => {
      const protectedByRecency = newestBackups.has(backup.name)
      const protectedByAge =
        nowMs - new Date(backup.createdAt).getTime() < minimumBackupAgeMs
      return {
        ...backup,
        protectedByRecency,
        protectedByAge,
        pruneEligible: !protectedByRecency && !protectedByAge
      }
    })
  const warnings = storageWarnings(backupNames.length, backupBytes)
  const compatibility = inspectCompatibility({
    paths: options.paths,
    deployments,
    backups,
    findings,
    ...(options.receiptDirectory === undefined
      ? {}
      : { receiptDirectory: options.receiptDirectory })
  })

  return {
    formatVersion: localPersistenceFormatVersions.localStorageInspection,
    installationRoot: options.paths.root,
    activeDeploymentFingerprint: active,
    deployments,
    backups,
    backupEntryCount: backupNames.length,
    backupBytes,
    findings: findings.sort(findingOrder),
    warnings,
    compatibility
  }
}

export function validateDeploymentDirectory(
  path: string,
  fingerprint: string,
  iconSourcePath: string
): InspectedDeployment {
  if (!deploymentFingerprintPattern.test(fingerprint))
    throw new Error('Entry is not a 64-hex SaltMarcher deployment')
  const stats = lstatSync(path)
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw new Error('Deployment entry is not an owned directory')
  const expectedInventory = [
    'SaltMarcher.AppImage',
    'artifact-manifest.json',
    'icon.png'
  ]
  if (
    JSON.stringify(readdirSync(path).sort()) !==
    JSON.stringify(expectedInventory)
  )
    throw new Error('Deployment contains an unexpected file inventory')
  const manifestPath = join(path, 'artifact-manifest.json')
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assertCurrentLocalPersistenceVersion(raw, 'localArtifactManifest')
  const manifest = localArtifactManifestSchema.parse(raw)
  if (manifest.receipt.build.channel !== 'local')
    throw new Error('Deployment manifest does not describe a Local build')
  if (manifest.receipt.build.workspaceFingerprint !== fingerprint)
    throw new Error('Deployment directory and workspace fingerprint differ')
  if (
    createHash('sha256')
      .update(JSON.stringify(manifest.receipt))
      .digest('hex') !== manifest.receiptSha256
  )
    throw new Error('Deployment receipt hash is invalid')
  if (
    sha256File(join(path, 'SaltMarcher.AppImage')) !== manifest.artifactSha256
  )
    throw new Error('Deployment AppImage hash is invalid')
  if (sha256File(join(path, 'icon.png')) !== sha256File(iconSourcePath))
    throw new Error('Deployment icon hash is invalid')
  return {
    fingerprint,
    path,
    builtAt: manifest.receipt.build.builtAt,
    bytes: treeBytes(path),
    manifestSha256: sha256File(manifestPath),
    manifestFormatVersion: 2
  }
}

export function validateBackupDirectory(
  path: string,
  name: string,
  knownBytes = treeBytes(path)
): Omit<
  ValidBackup,
  'protectedByRecency' | 'protectedByAge' | 'pruneEligible'
> {
  const stats = lstatSync(path)
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw new Error('Backup entry is not an owned directory')
  const manifestPath = join(path, 'backup-manifest.json')
  if (!existsSync(manifestPath)) throw new Error('Backup manifest is missing')
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assertCurrentLocalPersistenceVersion(raw, 'campaignBackupManifest')
  const manifest = backupManifestSchema.parse(raw)
  const actual = hashTree(path).filter(
    ({ path: relativePath }) => relativePath !== 'backup-manifest.json'
  )
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files))
    throw new Error('Backup file inventory or hashes are invalid')
  return {
    name,
    path,
    createdAt: manifest.createdAt,
    bytes: knownBytes,
    manifestSha256: sha256File(manifestPath)
  }
}

function activeDeployment(
  paths: LocalInstallationPaths,
  findings: StorageFinding[]
): string | null {
  try {
    const selected = resolve(
      dirname(paths.current),
      readlinkSync(paths.current)
    )
    const relativePath = relative(paths.deployments, selected)
    if (
      relativePath.includes(sep) ||
      relativePath.startsWith('..') ||
      !deploymentFingerprintPattern.test(relativePath)
    )
      throw new Error('Current does not select a direct deployment child')
    return relativePath
  } catch (error) {
    findings.push({
      area: 'deployments',
      name: 'current',
      reason: errorMessage(error)
    })
    return null
  }
}

function protectedDeployments(
  paths: LocalInstallationPaths,
  findings: StorageFinding[]
): { readonly fingerprints: Set<string>; readonly unknown: boolean } {
  try {
    const journal = readInstallJournal(paths.journal)
    if (
      journal === null ||
      journal.phase === 'completed' ||
      journal.phase === 'rolled-back' ||
      journal.deploymentPath === null
    )
      return { fingerprints: new Set(), unknown: false }
    const relativePath = relative(paths.deployments, journal.deploymentPath)
    if (
      relativePath.includes(sep) ||
      relativePath.startsWith('..') ||
      !deploymentFingerprintPattern.test(relativePath)
    )
      throw new Error('Nonterminal journal has an invalid deployment reference')
    return { fingerprints: new Set([relativePath]), unknown: false }
  } catch (error) {
    findings.push({
      area: 'deployments',
      name: 'install-journal.json',
      reason: errorMessage(error)
    })
    return { fingerprints: new Set(), unknown: true }
  }
}

export function storageWarnings(
  backupCount: number,
  backupBytes: number
): StorageWarning[] {
  const warnings: StorageWarning[] = []
  if (backupCount > backupCountWarningThreshold)
    warnings.push({
      code: 'backup-count-high',
      message: `${backupCount} campaign backups are retained; automatic deletion is disabled`
    })
  if (backupBytes > backupBytesWarningThreshold)
    warnings.push({
      code: 'backup-bytes-high',
      message: `${backupBytes} campaign-backup bytes are retained; automatic deletion is disabled`
    })
  return warnings
}

function newestFirst(left: InspectedDeployment, right: InspectedDeployment) {
  return right.builtAt === left.builtAt
    ? right.fingerprint.localeCompare(left.fingerprint, 'en')
    : right.builtAt.localeCompare(left.builtAt, 'en')
}

function findingOrder(left: StorageFinding, right: StorageFinding): number {
  return `${left.area}:${left.name}:${left.reason}`.localeCompare(
    `${right.area}:${right.name}:${right.reason}`,
    'en'
  )
}

function bestEffortBytes(path: string): number {
  try {
    return treeBytes(path)
  } catch {
    try {
      return lstatSync(path).size
    } catch {
      return 0
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
