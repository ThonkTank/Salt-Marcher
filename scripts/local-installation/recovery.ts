import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SchemaMigration } from '../../src/core/persistence/sqlite/schema-migrations.js'
import type {
  JournalReplacement,
  LocalInstallJournal
} from '../local-install-journal.js'
import type {
  InstallationReplacement,
  LocalInstallationPaths
} from './contract.js'
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

export function replaceAtomically(
  replacements: readonly InstallationReplacement[],
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
