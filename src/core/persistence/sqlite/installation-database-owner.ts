import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import {
  assertSchemaVersion,
  configureSqlite,
  IncompatibleDataError,
  initializeSchemaVersion
} from './database.js'
import { preflightPersistence } from './persistence-preflight.js'
import { initializeInstallationSchemaMetadata } from './installation-schema-migrations.js'
import {
  defaultInstallationPreferences,
  persistedInstallationPreferences,
  type InstallationPreferencesPatch,
  type InstallationSettings
} from '../../../shared/contracts/settings.js'
import { InstallationSettingsStore } from './installation-settings-store.js'
import { initializeCreatureSchema } from '../../creatures/catalog.js'
import { initializeLocationSymbolSchema } from '../../worldplanner/location-symbol-store.js'
import { initializeBiomeCatalogSchema } from '../../biomes/biome-catalog.js'
import { initializeGeneratorPresetSchema } from './generator-preset-store.js'
import {
  CampaignImportStore,
  initializeCampaignImportInstallationSchema
} from '../../campaign-import/campaign-import-store.js'
import { CampaignRegistryRepository } from './campaign-registry-repository.js'
import {
  sqliteDatabaseAccess,
  type SqliteDatabaseAccess
} from './database-access.js'
import type {
  CampaignLifecycleReceipt,
  CampaignLifecycleRegistration
} from '../../application/campaign-lifecycle-coordinator.js'

/** Owns the installation database handle and its installation-scoped stores. */
export class InstallationDatabaseOwner {
  readonly registry: CampaignRegistryRepository
  readonly campaignImports: CampaignImportStore
  private readonly database: Database.Database
  private readonly settings: InstallationSettingsStore
  private readonly persistence: SqliteDatabaseAccess

  constructor(dataRoot: string) {
    const preflight = preflightPersistence(dataRoot)
    if (preflight.kind === 'migration-required')
      throw new IncompatibleDataError(dataRoot)
    const installationExists = preflight.kind === 'ready'
    const installationPath = join(dataRoot, 'installation.sqlite')
    mkdirSync(dirname(installationPath), { recursive: true })
    this.database = new Database(installationPath)
    this.persistence = sqliteDatabaseAccess((visitor) => visitor(this.database))
    this.registry = new CampaignRegistryRepository(this.database)
    this.campaignImports = new CampaignImportStore(this.database)
    this.settings = new InstallationSettingsStore(this.database)
    try {
      configureSqlite(this.database)
      if (installationExists)
        assertSchemaVersion(this.database, dataRoot, 'installation')
      this.initializeInstallationSchema(installationExists)
    } catch (error) {
      this.database.close()
      throw error
    }
  }

  readSettings(): InstallationSettings {
    return this.settings.read()
  }

  updateSettings(
    patch: InstallationPreferencesPatch,
    expectedRevision: number
  ): InstallationSettings {
    return this.settings.update(patch, expectedRevision)
  }

  persistenceAccess(): SqliteDatabaseAccess {
    return this.persistence
  }

  campaignLifecycleRegistration(): CampaignLifecycleRegistration {
    return {
      commit: (receipt) => this.commitCampaignLifecycle(receipt),
      isCommitted: (receipt) => this.registry.lifecycleCommit(receipt),
      verify: (receipt) => this.verifyCampaignLifecycle(receipt),
      rollback: (receipt) => this.registry.restoreLifecycleRegistry(receipt),
      clear: (receipt) => this.registry.clearLifecycleCommit(receipt)
    }
  }

  close(): void {
    this.database.close()
  }

  private commitCampaignLifecycle(receipt: CampaignLifecycleReceipt): void {
    this.registry.commitLifecycle(receipt, () => {
      if (receipt.operation.kind === 'campaign-import')
        this.campaignImports.recordRegistryForSaga(receipt.operation.importId)
    })
  }

  private verifyCampaignLifecycle(receipt: CampaignLifecycleReceipt): boolean {
    return (
      this.registry.lifecycleReadback(receipt) &&
      (receipt.operation.kind !== 'campaign-import' ||
        this.campaignImports.registryMatchesSaga(receipt.operation.importId))
    )
  }

  private initializeInstallationSchema(installationExists: boolean): void {
    this.registry.initialize()
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS installation_settings (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
        revision INTEGER NOT NULL CHECK(revision >= 0),
        preferences_json TEXT NOT NULL
      );
    `)
    initializeGeneratorPresetSchema(this.database)
    this.database
      .prepare(
        'INSERT OR IGNORE INTO installation_settings (singleton, revision, preferences_json) VALUES (1, 0, ?)'
      )
      .run(
        JSON.stringify(
          persistedInstallationPreferences(defaultInstallationPreferences)
        )
      )
    initializeCreatureSchema(this.database)
    initializeBiomeCatalogSchema(this.database)
    initializeLocationSymbolSchema(this.database)
    initializeCampaignImportInstallationSchema(this.database)
    if (!installationExists) {
      initializeInstallationSchemaMetadata(this.database)
      initializeSchemaVersion(this.database, 'installation')
    }
  }
}
