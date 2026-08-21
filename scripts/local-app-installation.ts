import { mkdirSync, renameSync } from 'node:fs'
import type { LocalArtifactManifest } from '../src/shared/contracts/build-info.js'
import {
  schemaMigrations,
  type SchemaMigration
} from '../src/core/persistence/sqlite/schema-migrations.js'
import {
  createInstallJournal,
  readInstallJournal,
  writeInstallJournal,
  type LocalInstallJournal
} from './local-install-journal.js'
import {
  assertArtifactMatchesWorkspace,
  installationResult,
  LocalInstallCrashForTest,
  LocalInstallationError,
  localInstallationPaths,
  localInstallationTargets,
  readInstallationArtifact,
  readPreviousInstalledBuild,
  type InstallLocalAppOptions,
  type LocalInstallationFailure,
  type LocalInstallationPaths,
  type LocalInstallationResult,
  type LocalInstallationTarget
} from './local-installation/contract.js'
import {
  backupCampaignData,
  campaignDataHash,
  validateBackupCheckpoint
} from './local-installation/campaign-backup.js'
import {
  migrateCampaignData,
  readPersistencePreflight
} from './local-installation/campaign-migration.js'
import {
  activationReplacements,
  deploymentManifestSha256,
  stageDeployment,
  validateCompletedInstallation,
  validateDeploymentCheckpoint
} from './local-installation/deployment.js'
import {
  recoverActivationState,
  recoverCampaignMigrationArtifacts,
  replaceAtomically
} from './local-installation/recovery.js'
import {
  isInstalledLocalAppRunning,
  withInstallationLock
} from './local-installation/installation-lock.js'

export {
  isInstalledLocalAppRunning,
  LocalInstallCrashForTest,
  LocalInstallationError,
  localInstallationPaths,
  localInstallationTargets
}
export type {
  InstallLocalAppOptions,
  LocalInstallationFailure,
  LocalInstallationPaths,
  LocalInstallationResult,
  LocalInstallationTarget
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
  const manifest = readInstallationArtifact(options)
  assertArtifactMatchesWorkspace(options, manifest)
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
      const sourceDataHash = campaignDataHash(paths)
      const backup = backupCampaignData(
        paths,
        manifest.receipt.build,
        readPreviousInstalledBuild(paths.installedManifest),
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
        deploymentManifestSha256: deploymentManifestSha256(deployment)
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
    replaceAtomically(
      activationReplacements(
        paths,
        deployment,
        options.iconSourcePath,
        manifest.receipt.build
      ),
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
    const manifest = readInstallationArtifact(options)
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
  recoverCampaignMigrationArtifacts(paths, journal, migrations)
  let recovered = recoverActivationState(paths, journal)
  if (journal.replacements.length === 0)
    recovered = {
      ...recovered,
      campaignDataHash: campaignDataHash(paths),
      migration: null
    }
  writeInstallJournal(paths.journal, recovered, now)
}
