import { existsSync, renameSync, rmSync } from 'node:fs'
import type { SchemaMigration } from '../../src/core/persistence/sqlite/schema-migrations.js'
import type {
  JournalReplacement,
  LocalInstallJournal
} from '../local-install-journal.js'
import type { LocalInstallationPaths } from './contract.js'
import { campaignPersistenceIsReady } from './campaign-migration.js'
import { currentSelectsDeployment } from './deployment.js'

export function recoverCampaignMigrationArtifacts(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal,
  migrations: readonly SchemaMigration[]
): void {
  const migration = journal.migration
  if (migration === null) return
  const dataWasCommitted = phaseAtLeast(journal.phase, 'data-promoted')
  if (existsSync(migration.rollback)) {
    if (
      dataWasCommitted &&
      campaignPersistenceIsReady(paths.campaignData, migrations)
    )
      rmSync(migration.rollback, { recursive: true, force: true })
    else {
      rmSync(paths.campaignData, { recursive: true, force: true })
      renameSync(migration.rollback, paths.campaignData)
    }
  }
  rmSync(migration.staging, { recursive: true, force: true })
}

export function recoverActivationState(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal
): LocalInstallJournal {
  if (journal.replacements.length === 0)
    return {
      ...journal,
      phase:
        journal.deploymentPath === null ? 'rolled-back' : 'deployment-staged',
      replacements: []
    }
  const committed =
    journal.deploymentPath !== null &&
    currentSelectsDeployment(paths.current, journal.deploymentPath)
  if (committed && replacementsArePresent(journal.replacements)) {
    cleanupReplacementDebris(journal.replacements)
    return { ...journal, phase: 'completed' }
  }
  rollbackReplacements(journal.replacements)
  return {
    ...journal,
    phase:
      journal.deploymentPath === null ? 'rolled-back' : 'deployment-staged',
    replacements: []
  }
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
