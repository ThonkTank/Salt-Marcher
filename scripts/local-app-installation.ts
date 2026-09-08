import { readAppImageLauncher } from '../src/shared/maintenance/appimage-launcher.js'
import { installMaintenanceLauncher } from '../src/shared/maintenance/launcher.js'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, join } from 'node:path'
import { MaintenanceCoordinator } from '../src/shared/maintenance/coordinator.js'
import {
  currentLocalProgram,
  localProgram
} from '../src/shared/maintenance/local-program.js'
import { migratePreparedProfile } from '../src/core/maintenance/profile-maintenance.js'
import type { LocalArtifactManifest } from '../src/shared/contracts/build-info.js'
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
  backupPayload,
  campaignDataHash,
  validateBackupCheckpoint
} from './local-installation/campaign-backup.js'
import { readPersistencePreflight } from './local-installation/campaign-migration.js'
import {
  desktopIntegration,
  deploymentManifestSha256,
  stageDeployment,
  validateCompletedInstallation,
  validateDeploymentCheckpoint
} from './local-installation/deployment.js'
import { adoptLegacyLocalMaintenance } from './local-installation/legacy-maintenance.js'
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
  if (journal) adoptLegacyLocalMaintenance(paths, journal)
  const coordinator = new MaintenanceCoordinator(
    paths.root,
    options.afterMaintenanceBoundaryForTest,
    options.renameForInstall
  )
  const pending = coordinator.read()
  if (pending && !['committed', 'rolled-back'].includes(pending.phase)) {
    if (
      pending.phase === 'awaiting-start' &&
      matches(journal) &&
      journal &&
      pending.next.sha256 === manifest.artifactSha256 &&
      pending.next.deployment === manifest.receipt.build.workspaceFingerprint
    ) {
      journal = writeInstallJournal(
        paths.journal,
        {
          ...journal,
          phase: 'completed',
          campaignDataHash: campaignDataHash(paths)
        },
        now
      )
    } else {
      coordinator.rollback()
      if (journal)
        journal = writeInstallJournal(
          paths.journal,
          { ...journal, phase: 'rolled-back' },
          now
        )
    }
  }
  if (
    journal !== null &&
    (!matches(journal) ||
      !['backup-complete', 'deployment-staged', 'completed'].includes(
        journal.phase
      ))
  ) {
    recoverInterruptedInstallation(paths, now)
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
      const backup = backupCampaignData(
        paths,
        manifest.receipt.build,
        readPreviousInstalledBuild(paths.installedManifest),
        preflight.databases,
        now
      )
      const sourceDataHash = backup?.sourceDataHash ?? campaignDataHash(paths)
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
    const deployment = activeJournal.deploymentPath
    if (deployment === null)
      throw new Error('Installation journal has no staged deployment')
    const id = randomUUID()
    const staging = join(paths.root, `staged-${id}`)
    const source = activeJournal.backupPath
      ? backupPayload(activeJournal.backupPath)
      : paths.campaignData
    if (existsSync(source))
      cpSync(source, staging, {
        recursive: true,
        errorOnExist: true,
        force: false,
        filter: (path) =>
          path !== join(activeJournal.backupPath ?? '', 'backup-manifest.json')
      })
    else mkdirSync(staging)
    try {
      migratePreparedProfile(staging, options.schemaMigrations)
    } catch (cause) {
      throw new LocalInstallationError(
        'migration-failed',
        'Prepared profile failed migration or domain validation; current data is unchanged',
        { cause }
      )
    }
    const previousProgram = currentLocalProgram(paths.root)
    const nextProgram = localProgram(paths.root, basename(deployment))
    const targetAppImage = join(deployment, 'SaltMarcher.AppImage')
    const launcher = (options.readLauncherForTest ?? readAppImageLauncher)(
      targetAppImage,
      nextProgram.sha256
    )
    const interpreter = previousProgram ?? nextProgram
    installMaintenanceLauncher(
      paths.root,
      {
        path: join(
          paths.deployments,
          interpreter.deployment,
          'SaltMarcher.AppImage'
        ),
        sha256: interpreter.sha256
      },
      launcher
    )
    coordinator.begin({
      id,
      operation: previousProgram ? 'update' : 'install',
      previous: previousProgram,
      next: nextProgram,
      backup: activeJournal.backupPath
        ? basename(activeJournal.backupPath)
        : null,
      integration: desktopIntegration(
        paths,
        join(deployment, 'icon.png'),
        manifest.receipt.build
      )
    })
    coordinator.activate()
    updateJournal({
      phase: 'completed',
      campaignDataHash: campaignDataHash(paths)
    })
    validateCompletedInstallation(paths, manifest, options.iconSourcePath)
    return installationResult(paths, manifest, activeJournal)
  } catch (error) {
    if (error instanceof LocalInstallCrashForTest) throw error
    recoverInterruptedInstallation(paths, now)
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
      const maintenance = new MaintenanceCoordinator(paths.root).read()
      if (
        maintenance &&
        (!['awaiting-start', 'committed'].includes(maintenance.phase) ||
          maintenance.next.sha256 !== manifest.artifactSha256 ||
          maintenance.next.deployment !==
            manifest.receipt.build.workspaceFingerprint)
      )
        return null
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
  now: () => Date = () => new Date()
): void {
  const journal = readInstallJournal(paths.journal)
  if (journal) adoptLegacyLocalMaintenance(paths, journal)
  const coordinator = new MaintenanceCoordinator(paths.root)
  coordinator.rollback()
  if (journal && !['completed', 'rolled-back'].includes(journal.phase))
    writeInstallJournal(
      paths.journal,
      {
        ...journal,
        phase: 'rolled-back',
        migration: null,
        replacements: []
      },
      now
    )
}
