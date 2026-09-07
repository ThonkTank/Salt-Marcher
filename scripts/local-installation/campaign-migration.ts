import { migrateProfile } from '../../src/core/maintenance/profile-snapshot.js'
import { cpSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  CorruptDataError,
  IncompatibleDataError
} from '../../src/core/persistence/sqlite/database.js'
import {
  preflightPersistence,
  type PersistencePreflight
} from '../../src/core/persistence/sqlite/persistence-preflight.js'
import { type SchemaMigration } from '../../src/core/persistence/sqlite/schema-migrations.js'
import type { LocalInstallJournal } from '../local-install-journal.js'
import {
  LocalInstallCrashForTest,
  LocalInstallationError,
  type LocalInstallationPaths
} from './contract.js'
import { campaignDataHash } from './campaign-backup.js'

export function readPersistencePreflight(
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

export function migrateCampaignData(
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
    if (preflight.databases.length === 0)
      throw new Error('Migration requires a declared database inventory')
    migrateProfile(staging, migrations)
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
        campaignDataHash: campaignDataHash(paths)
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

export function campaignPersistenceIsReady(
  path: string,
  migrations: readonly SchemaMigration[]
): boolean {
  try {
    return preflightPersistence(path, migrations).kind === 'ready'
  } catch {
    return false
  }
}
