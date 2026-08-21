import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync
} from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import {
  databaseSchemaVersions,
  type DatabaseRole
} from '../../src/core/persistence/sqlite/database.js'
import { resolveSchemaMigrationPath } from '../../src/core/persistence/sqlite/schema-migrations.js'
import { localPersistenceFormatVersions } from '../../src/shared/contracts/local-persistence-format-versions.js'
import type { LocalInstallationPaths } from '../local-installation/contract.js'
import type {
  CompatibilityArtifact,
  CompatibilityInspection,
  StorageFinding,
  ValidBackup,
  ValidDeployment
} from './contract.js'

export interface InspectCompatibilityOptions {
  readonly paths: LocalInstallationPaths
  readonly deployments: readonly ValidDeployment[]
  readonly backups: readonly ValidBackup[]
  readonly findings: readonly StorageFinding[]
  readonly receiptDirectory?: string
}

/** Classifies owned bytes without opening SQLite or mutating an inspected root. */
export function inspectCompatibility(
  options: InspectCompatibilityOptions
): CompatibilityInspection {
  const artifacts: CompatibilityArtifact[] = []
  scanDatabases(options.paths.campaignData, 'profile', true, artifacts)
  scanLifecycleDirectory(
    join(options.paths.campaignData, 'campaigns', '.transitions'),
    'profile',
    true,
    artifacts
  )

  const succeededBackups = compatibilitySuccessorSources(options.backups)
  for (const backup of options.backups) {
    artifacts.push(
      artifact(
        'backup',
        backup.name,
        backup.path,
        'current',
        'campaign-backup-manifest-v1',
        false,
        'Version one is the current immutable backup envelope'
      )
    )
    scanDatabases(backup.path, 'backup', false, artifacts)
    scanLifecycleDirectory(
      join(backup.path, 'campaigns', '.transitions'),
      'backup',
      false,
      artifacts,
      succeededBackups.has(backup.name) ? 'migratable' : undefined
    )
  }
  for (const finding of options.findings.filter(
    ({ area }) => area === 'backups'
  ))
    artifacts.push(
      artifact(
        'backup',
        finding.name,
        join(options.paths.backups, finding.name),
        'unknown-invalid',
        'unverified',
        false,
        finding.reason
      )
    )

  for (const deployment of options.deployments)
    artifacts.push(
      artifact(
        'deployment',
        deployment.fingerprint,
        deployment.path,
        'current',
        `deployment-manifest-v${deployment.manifestFormatVersion}`,
        deployment.retention === 'keep',
        'Current receipt-backed deployment manifest'
      )
    )
  for (const finding of options.findings.filter(
    ({ area }) => area === 'deployments'
  ))
    artifacts.push(
      artifact(
        'deployment',
        finding.name,
        finding.name === 'current'
          ? options.paths.current
          : finding.name === 'install-journal.json'
            ? options.paths.journal
            : join(options.paths.deployments, finding.name),
        'unknown-invalid',
        'unverified',
        finding.name === 'current' || finding.name === 'install-journal.json',
        finding.reason
      )
    )

  scanVersionedJson(
    options.paths.journal,
    'install-journal',
    'install-journal.json',
    localPersistenceFormatVersions.localInstallJournal,
    artifacts
  )
  scanLegacyRoot(options.paths, artifacts)
  if (options.receiptDirectory !== undefined)
    scanHandoff(options.receiptDirectory, artifacts)

  const ordered = artifacts.sort((left, right) =>
    `${left.area}:${left.path}:${left.format}`.localeCompare(
      `${right.area}:${right.path}:${right.format}`,
      'en'
    )
  )
  return {
    formatVersion:
      localPersistenceFormatVersions.localStorageCompatibilityInspection,
    artifacts: ordered,
    reachableLegacyCount: 0,
    reachableNonCurrentCount: ordered.filter(
      ({ status, applicationReachable }) =>
        status !== 'current' && applicationReachable
    ).length,
    unknownInvalidCount: ordered.filter(
      ({ status }) => status === 'unknown-invalid'
    ).length
  }
}

function compatibilitySuccessorSources(
  backups: readonly ValidBackup[]
): Set<string> {
  const sources = new Set<string>()
  const manifests = new Map(
    backups.map((backup) => [backup.name, backup.manifestSha256])
  )
  for (const backup of backups) {
    const manifest = JSON.parse(
      readFileSync(join(backup.path, 'backup-manifest.json'), 'utf8')
    ) as Record<string, unknown>
    const provenance = manifest['compatibilitySuccessorOf']
    if (
      typeof provenance === 'object' &&
      provenance !== null &&
      'name' in provenance &&
      typeof provenance.name === 'string' &&
      'manifestSha256' in provenance &&
      typeof provenance.manifestSha256 === 'string' &&
      manifests.get(provenance.name) === provenance.manifestSha256 &&
      !directoryHasLegacyLifecycle(backup.path)
    )
      sources.add(provenance.name)
  }
  return sources
}

function directoryHasLegacyLifecycle(backupPath: string): boolean {
  const directory = join(backupPath, 'campaigns', '.transitions')
  if (!existsSync(directory)) return false
  return readdirSync(directory).some((name) => {
    try {
      const value = JSON.parse(
        readFileSync(join(directory, name), 'utf8')
      ) as Record<string, unknown>
      return value['schemaVersion'] !== 2
    } catch {
      return true
    }
  })
}

function scanDatabases(
  root: string,
  area: 'profile' | 'backup',
  reachable: boolean,
  artifacts: CompatibilityArtifact[]
): void {
  for (const path of filesRecursively(root).filter((file) =>
    file.endsWith('.sqlite')
  )) {
    const role = databaseRole(root, path)
    if (role === null) {
      artifacts.push(
        artifact(
          area,
          relative(root, path),
          path,
          'unknown-invalid',
          'sqlite',
          reachable,
          'SQLite path has no declared aggregate role'
        )
      )
      continue
    }
    try {
      const version = sqliteHeaderUserVersion(path)
      const expected = databaseSchemaVersions[role]
      const migrations = resolveSchemaMigrationPath(role, version)
      artifacts.push(
        artifact(
          area,
          relative(root, path),
          path,
          version === expected
            ? 'current'
            : migrations !== null
              ? 'migratable'
              : 'unknown-invalid',
          `${role}-schema-v${version}`,
          reachable,
          version === expected
            ? 'Database schema is current'
            : migrations !== null
              ? `Registered migration path has ${migrations.length} step(s)`
              : `No migration path to schema ${expected}`
        )
      )
    } catch (error) {
      artifacts.push(
        artifact(
          area,
          relative(root, path),
          path,
          'unknown-invalid',
          'sqlite',
          reachable,
          errorMessage(error)
        )
      )
    }
  }
}

function scanLifecycleDirectory(
  directory: string,
  area: 'profile' | 'backup',
  reachable: boolean,
  artifacts: CompatibilityArtifact[],
  legacyStatus?: 'migratable'
): void {
  if (!existsSync(directory)) return
  for (const name of readdirSync(directory).sort())
    scanVersionedJson(
      join(directory, name),
      area,
      name,
      localPersistenceFormatVersions.campaignLifecycleReceipt,
      artifacts,
      'schemaVersion',
      reachable,
      legacyStatus
    )
}

function scanHandoff(
  receiptDirectory: string,
  artifacts: CompatibilityArtifact[]
): void {
  scanHandoffHistory(receiptDirectory, artifacts)
  for (const directory of ['states', 'attempts'] as const)
    for (const path of filesRecursively(join(receiptDirectory, directory)))
      if (path.endsWith('.json'))
        scanVersionedJson(
          path,
          'handoff-state',
          relative(receiptDirectory, path),
          localPersistenceFormatVersions.handoffReceipt,
          artifacts,
          'formatVersion',
          directory === 'states'
        )
}

function scanHandoffHistory(
  receiptDirectory: string,
  artifacts: CompatibilityArtifact[]
): void {
  const path = join(receiptDirectory, 'invocations.json')
  if (!existsSync(path)) return
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
    if (
      value['formatVersion'] !==
      localPersistenceFormatVersions.handoffInvocationHistory
    ) {
      scanVersionedJson(
        path,
        'handoff-history',
        'invocations.json',
        localPersistenceFormatVersions.handoffInvocationHistory,
        artifacts
      )
      return
    }
    const rawInvocations: unknown = value['invocations']
    const invocations: unknown[] = Array.isArray(rawInvocations)
      ? (rawInvocations as unknown[])
      : []
    const attemptsRoot = join(receiptDirectory, 'attempts')
    const oldLayout = invocations.some(
      (entry) => !usesCurrentAttemptLayout(entry, attemptsRoot)
    )
    artifacts.push(
      artifact(
        'handoff-history',
        'invocations.json',
        path,
        oldLayout ? 'unsupported-obsolete' : 'current',
        oldLayout ? 'invocation-history-v2-legacy-layout' : 'formatVersion-v2',
        true,
        oldLayout
          ? 'Unsupported pre-attempt invocation detail layout'
          : 'Current format and attempt-detail layout'
      )
    )
  } catch (error) {
    artifacts.push(
      artifact(
        'handoff-history',
        'invocations.json',
        path,
        'unknown-invalid',
        'unparseable-json',
        true,
        errorMessage(error)
      )
    )
  }
}

function usesCurrentAttemptLayout(
  value: unknown,
  attemptsRoot: string
): boolean {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const attemptId = record['attemptId']
  const auditPath = record['auditPath']
  return (
    typeof attemptId === 'string' &&
    typeof auditPath === 'string' &&
    resolve(auditPath) === resolve(attemptsRoot, `${attemptId}.json`)
  )
}

function scanVersionedJson(
  path: string,
  area: CompatibilityArtifact['area'],
  name: string,
  currentVersion: number,
  artifacts: CompatibilityArtifact[],
  field = 'formatVersion',
  applicationReachable = true,
  legacyStatus?: 'migratable'
): void {
  if (!existsSync(path)) return
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
    const version = value[field]
    if (typeof version !== 'number' || !Number.isInteger(version))
      throw new Error(`Missing integer ${field}`)
    artifacts.push(
      artifact(
        area,
        name,
        path,
        version === currentVersion
          ? 'current'
          : version < currentVersion
            ? (legacyStatus ?? 'unsupported-obsolete')
            : 'unknown-invalid',
        `${field}-v${version}`,
        applicationReachable,
        version === currentVersion
          ? 'Current format'
          : version < currentVersion
            ? legacyStatus === 'migratable'
              ? 'Immutable source has a verified current-format successor'
              : `Unsupported obsolete version; expected ${currentVersion}`
            : `Format is newer than supported version ${currentVersion}`
      )
    )
  } catch (error) {
    artifacts.push(
      artifact(
        area,
        name,
        path,
        'unknown-invalid',
        'unparseable-json',
        applicationReachable,
        errorMessage(error)
      )
    )
  }
}

function scanLegacyRoot(
  paths: LocalInstallationPaths,
  artifacts: CompatibilityArtifact[]
): void {
  const marker = join(paths.root, 'installed-artifact.json')
  const image = join(paths.root, 'SaltMarcher.AppImage')
  if (!existsSync(marker) && !existsSync(image)) return
  if (!existsSync(marker)) {
    artifacts.push(
      artifact(
        'deployment',
        'legacy-root-installation',
        image,
        'unknown-invalid',
        'unowned-root-appimage',
        false,
        'Legacy root AppImage has no ownership marker'
      )
    )
    return
  }
  try {
    const value = JSON.parse(readFileSync(marker, 'utf8')) as Record<
      string,
      unknown
    >
    if (value['formatVersion'] !== 1)
      throw new Error('Legacy root marker has an unknown format version')
    artifacts.push(
      artifact(
        'deployment',
        'legacy-root-installation',
        marker,
        'unsupported-obsolete',
        'installed-artifact-v1',
        false,
        'Unsupported pre-deployment installation layout; expected a versioned deployment manifest'
      )
    )
  } catch (error) {
    artifacts.push(
      artifact(
        'deployment',
        'legacy-root-installation',
        marker,
        'unknown-invalid',
        'unverified-root-installation',
        false,
        errorMessage(error)
      )
    )
  }
}

function sqliteHeaderUserVersion(path: string): number {
  const descriptor = openSync(path, 'r')
  try {
    const bytes = Buffer.alloc(100)
    if (readSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length)
      throw new Error('Invalid SQLite header length')
    if (bytes.subarray(0, 16).toString('binary') !== 'SQLite format 3\u0000')
      throw new Error('Invalid SQLite header')
    return bytes.readUInt32BE(60)
  } finally {
    closeSync(descriptor)
  }
}

function databaseRole(root: string, path: string): DatabaseRole | null {
  const parts = relative(root, path).split(sep)
  if (parts.length === 1 && parts[0] === 'installation.sqlite')
    return 'installation'
  if (
    parts.length >= 3 &&
    parts[0] === 'campaigns' &&
    parts.at(-1) === 'campaign.sqlite'
  )
    return 'campaign'
  return null
}

function filesRecursively(root: string): string[] {
  if (!existsSync(root)) return []
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) files.push(...filesRecursively(path))
    else if (entry.isFile()) files.push(path)
  }
  return files.sort()
}

function artifact(
  area: CompatibilityArtifact['area'],
  name: string,
  path: string,
  status: CompatibilityArtifact['status'],
  format: string,
  applicationReachable: boolean,
  reason: string
): CompatibilityArtifact {
  return { area, name, path, status, format, applicationReachable, reason }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
