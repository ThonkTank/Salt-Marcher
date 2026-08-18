import {
  existsSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'
import {
  assertSchemaVersion,
  configureSqlite,
  databaseSchemaVersions,
  IncompatibleDataError,
  initializeSchemaVersion
} from './database.js'
import { preflightPersistence } from './persistence-preflight.js'
import { initializeInstallationSchemaMetadata } from './installation-schema-migrations.js'
import {
  defaultInstallationPreferences,
  type InstallationPreferencesPatch,
  type InstallationSettings
} from '../../../shared/contracts/settings.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { InstallationSettingsStore } from './installation-settings-store.js'
import { initializeCreatureSchema } from '../../creatures/catalog.js'
import { initializeLocationSymbolSchema } from '../../worldplanner/location-symbol-store.js'
import { initializeBiomeCatalogSchema } from '../../biomes/biome-catalog.js'
import { initializeGeneratorPresetSchema } from './generator-preset-store.js'
import type { IncompatibleDataPolicy } from '../../../shared/contracts/runtime.js'
import {
  CampaignImportStore,
  initializeCampaignImportInstallationSchema
} from '../../campaign-import/campaign-import-store.js'
import {
  CampaignDirectoryTransition,
  type CampaignDirectoryTransitionReceipt
} from './campaign-directory-transition.js'
import { CampaignConnectionManager } from './campaign-connection-manager.js'
import { CampaignRegistryRepository } from './campaign-registry-repository.js'
import {
  CampaignSchemaBootstrapper,
  createDefaultCampaignSchemaBootstrapper
} from './campaign-schema-bootstrapper.js'

export type CampaignCreatePhase =
  | 'before-registry-entry'
  | 'after-creating-entry'
  | 'after-store-created'
  | 'before-ready'

export type CampaignReplacePhase =
  | 'before-original-move'
  | 'after-original-move'
  | 'before-replacement-promote'
  | 'after-replacement-promote'
  | 'before-replacement-open'
  | 'after-replacement-open'
  | 'before-registry-commit'
  | 'after-registry-commit'
  | 'before-cleanup'
  | 'after-cleanup'

export interface CampaignStoreOptions {
  /** Test seam for simulating a process interruption at durable create boundaries. */
  onCreatePhase?: (phase: CampaignCreatePhase) => void
  /** Failure-injection seam at real replacement transition boundaries. */
  onReplacePhase?: (phase: CampaignReplacePhase) => void
  schemaBootstrapper?: CampaignSchemaBootstrapper
}

export class CampaignStore {
  private readonly installation: Database.Database
  private readonly registry: CampaignRegistryRepository
  private readonly installationSettings: InstallationSettingsStore
  private readonly campaignImports: CampaignImportStore
  private readonly connections = new CampaignConnectionManager()
  private readonly onCreatePhase:
    ((phase: CampaignCreatePhase) => void) | undefined
  private readonly onReplacePhase:
    ((phase: CampaignReplacePhase) => void) | undefined
  private readonly directoryTransition: CampaignDirectoryTransition
  private readonly schemaBootstrapper: CampaignSchemaBootstrapper

  constructor(
    private readonly dataRoot: string,
    options: CampaignStoreOptions = {}
  ) {
    this.onCreatePhase = options.onCreatePhase
    this.onReplacePhase = options.onReplacePhase
    this.schemaBootstrapper =
      options.schemaBootstrapper ?? createDefaultCampaignSchemaBootstrapper()
    this.directoryTransition = new CampaignDirectoryTransition(
      dataRoot,
      (path) => this.isValidCampaignStore(path)
    )
    const installationPath = join(dataRoot, 'installation.sqlite')
    const preflight = preflightPersistence(dataRoot)
    if (preflight.kind === 'migration-required')
      throw new IncompatibleDataError(dataRoot)
    const installationExists = preflight.kind === 'ready'
    mkdirSync(dirname(installationPath), { recursive: true })
    this.installation = new Database(installationPath)
    this.registry = new CampaignRegistryRepository(this.installation)
    this.campaignImports = new CampaignImportStore(this.installation)
    this.installationSettings = new InstallationSettingsStore(this.installation)
    try {
      configureSqlite(this.installation)
      if (installationExists)
        assertSchemaVersion(this.installation, this.dataRoot, 'installation')
      this.registry.initialize()
      this.installation.exec(`
      CREATE TABLE IF NOT EXISTS installation_settings (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
        revision INTEGER NOT NULL CHECK(revision >= 0),
        preferences_json TEXT NOT NULL
      );
      `)
      initializeGeneratorPresetSchema(this.installation)
      this.installation
        .prepare(
          'INSERT OR IGNORE INTO installation_settings (singleton, revision, preferences_json) VALUES (1, 0, ?)'
        )
        .run(JSON.stringify(defaultInstallationPreferences))
      initializeCreatureSchema(this.installation)
      initializeBiomeCatalogSchema(this.installation)
      initializeLocationSymbolSchema(this.installation)
      initializeCampaignImportInstallationSchema(this.installation)
      if (!installationExists) {
        initializeInstallationSchemaMetadata(this.installation)
        initializeSchemaVersion(this.installation, 'installation')
      }
      this.recoverIncompleteCreations()
      this.recoverCampaignDirectoryTransitions()
      this.openRecordedActiveCampaign()
    } catch (error) {
      this.installation.close()
      throw error
    }
  }

  list(): CampaignSnapshot {
    return this.registry.snapshot()
  }

  create(name: string): CampaignSnapshot {
    const id = uuidv7()
    const createdAt = new Date().toISOString()
    this.onCreatePhase?.('before-registry-entry')
    this.registry.beginCreation(id, name, createdAt)
    this.onCreatePhase?.('after-creating-entry')
    this.createStagedCampaignStore(id)
    this.onCreatePhase?.('after-store-created')
    this.finalizeCampaignCreation(id)
    return this.list()
  }

  activate(id: string): CampaignSnapshot {
    this.registry.requireAvailable(id)
    this.switchActiveCampaign(id)
    this.registry.setActive(id)
    return this.list()
  }

  rename(id: string, name: string): CampaignSnapshot {
    this.registry.rename(id, name)
    return this.list()
  }

  trash(id: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.registry.requireAvailable(id)

    if (this.list().activeCampaignId === id) {
      this.connections.release(id)
    }
    this.registry.trash(id, new Date().toISOString())
    this.moveDirectory(this.campaignDirectory(id), this.trashDirectory(id))
    return this.list()
  }

  restore(id: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.registry.requireTrashed(id)

    this.moveDirectory(this.trashDirectory(id), this.campaignDirectory(id))
    this.registry.restore(id)
    return this.list()
  }

  deleteForever(id: string, confirmationName: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.registry.requireDeletionName(id, confirmationName)

    this.moveDirectory(this.trashDirectory(id), this.deletingDirectory(id))
    this.registry.delete(id)
    rmSync(this.deletingDirectory(id), { recursive: true, force: true })
    return this.list()
  }

  readSettings(): InstallationSettings {
    return this.installationSettings.read()
  }

  updateSettings(
    patch: InstallationPreferencesPatch,
    expectedRevision: number
  ): InstallationSettings {
    return this.installationSettings.update(patch, expectedRevision)
  }

  close(): void {
    this.connections.close()
    this.installation.close()
  }

  activeCampaignDatabase(): Database.Database {
    return this.connections.compatibilityDatabase()
  }

  /**
   * Builds an import in an isolated database and exposes it only after the
   * caller's complete domain readback succeeds. Re-import replaces the prior
   * image at the same campaign identity, so external identities stay singular.
   */
  stageImportedCampaign<T>(
    name: string,
    existingId: string | null,
    populateAndVerify: (database: Database.Database) => T,
    reservedId?: string
  ): Readonly<{
    campaignId: string
    snapshot: CampaignSnapshot
    quickCheck: 'ok'
    evidence: T
    directoryTransition: unknown
  }> {
    const id = existingId ?? reservedId ?? uuidv7()
    if (reservedId !== undefined) this.requireSafeCampaignId(reservedId)
    if (existingId !== null) this.requireSafeCampaignId(existingId)
    const previousActiveId = this.list().activeCampaignId
    const createdAt = new Date().toISOString()
    rmSync(this.stagedCampaignDirectory(id), { recursive: true, force: true })
    if (existingId === null)
      this.registry.insertImportCreation(id, name, createdAt)
    try {
      if (existingId === null) this.createStagedCampaignStore(id)
      else this.cloneCampaignToStage(id)
      const staged = new Database(this.stagedCampaignPath(id))
      try {
        configureSqlite(staged)
        assertSchemaVersion(
          staged,
          this.stagedCampaignDirectory(id),
          'campaign'
        )
        const evidence = populateAndVerify(staged)
        if (staged.pragma('quick_check', { simple: true }) !== 'ok')
          throw new Error('Imported campaign failed quick_check')
        staged.close()
        if (!this.isValidCampaignStore(this.stagedCampaignPath(id)))
          throw new Error('Imported campaign failed staged store validation')
        const directoryTransition =
          existingId === null
            ? this.finalizeImportedCampaignCreation(id)
            : this.replaceCampaignFromStage(id, name, previousActiveId)
        return {
          campaignId: id,
          snapshot: this.list(),
          quickCheck: 'ok',
          evidence,
          directoryTransition
        }
      } finally {
        if (staged.open) staged.close()
      }
    } catch (error) {
      if (
        existingId === null ||
        (this.directoryTransition.receipt(id) === null &&
          this.isValidCampaignStore(this.campaignPath(id)))
      )
        rmSync(this.stagedCampaignDirectory(id), {
          recursive: true,
          force: true
        })
      if (existingId === null) {
        rmSync(this.campaignDirectory(id), { recursive: true, force: true })
        this.registry.removeIncompleteCreation(id)
      }
      throw error
    }
  }

  installationDatabase(): Database.Database {
    return this.installation
  }

  campaignImportRepository(): CampaignImportStore {
    return this.campaignImports
  }

  discardFailedImportedCampaign(
    campaignId: string,
    previousActiveCampaignId: string | null
  ): void {
    this.requireSafeCampaignId(campaignId)
    if (this.connections.activeId() === campaignId)
      this.connections.release(campaignId)
    this.registry.delete(campaignId)
    rmSync(this.stagedCampaignDirectory(campaignId), {
      recursive: true,
      force: true
    })
    rmSync(this.campaignDirectory(campaignId), {
      recursive: true,
      force: true
    })
    if (previousActiveCampaignId !== null) {
      this.registry.requireAvailable(previousActiveCampaignId)
      this.registry.setActive(previousActiveCampaignId)
      this.switchActiveCampaign(previousActiveCampaignId)
    }
  }

  visitCampaignDatabase<T>(
    campaignId: string,
    visitor: (database: Database.Database) => T
  ): T | null {
    const result = this.visitCampaignDatabases(({ id, database }) =>
      id === campaignId ? visitor(database) : null
    ).find((value): value is T => value !== null)
    return result ?? null
  }

  visitCampaignDatabases<T>(
    visitor: (campaign: {
      id: string
      name: string
      trashed: boolean
      database: Database.Database
    }) => T
  ): T[] {
    const activeId = this.list().activeCampaignId
    const rows = this.registry.readyRows()
    return rows.map((row) => {
      if (row.id === activeId && this.connections.activeId() === row.id)
        return visitor({
          id: row.id,
          name: row.name,
          trashed: false,
          database: this.connections.compatibilityDatabase()
        })
      const path = row.trashedAt
        ? join(this.trashDirectory(row.id), 'campaign.sqlite')
        : this.campaignPath(row.id)
      const database = new Database(path)
      try {
        configureSqlite(database)
        assertSchemaVersion(database, undefined, 'campaign')
        return visitor({
          id: row.id,
          name: row.name,
          trashed: row.trashedAt !== null,
          database
        })
      } finally {
        database.close()
      }
    })
  }

  activeCampaignId(): string {
    const id = this.list().activeCampaignId
    if (id === null) throw new CapabilityError('not_found', false)
    return id
  }

  /** Diagnostic path used by integration fixtures and incompatibility reports. */
  activeCampaignPath(): string {
    const id = this.list().activeCampaignId
    if (id === null) throw new CapabilityError('not_found', false)
    return this.campaignPath(id)
  }

  private createStagedCampaignStore(id: string): void {
    const campaignPath = this.stagedCampaignPath(id)
    mkdirSync(dirname(campaignPath), { recursive: true })
    const campaign = new Database(campaignPath)
    configureSqlite(campaign)
    this.schemaBootstrapper.initialize(campaign)
    campaign.close()
  }

  private cloneCampaignToStage(id: string): void {
    const stagedPath = this.stagedCampaignPath(id)
    mkdirSync(dirname(stagedPath), { recursive: true })
    let source: Database.Database | undefined
    const borrowedActive = this.connections.activeId() === id
    try {
      source = borrowedActive
        ? this.connections.compatibilityDatabase()
        : new Database(this.campaignPath(id))
      configureSqlite(source)
      assertSchemaVersion(source, this.campaignDirectory(id), 'campaign')
      source.pragma('wal_checkpoint(FULL)')
      copyFileSync(this.campaignPath(id), stagedPath)
    } finally {
      if (!borrowedActive) source?.close()
    }
  }

  private finalizeCampaignCreation(id: string): void {
    const stagedDirectory = this.stagedCampaignDirectory(id)
    const campaignDirectory = this.campaignDirectory(id)
    if (existsSync(stagedDirectory) && !existsSync(campaignDirectory))
      renameSync(stagedDirectory, campaignDirectory)
    if (!this.isValidCampaignStore(this.campaignPath(id)))
      throw new Error('Campaign store creation did not complete')
    this.onCreatePhase?.('before-ready')
    this.registry.markReadyAndActivate(id)
    this.switchActiveCampaign(id)
  }

  private finalizeImportedCampaignCreation(id: string): Readonly<{
    kind: 'creation'
    campaignId: string
    phase: 'complete'
  }> {
    this.finalizeCampaignCreation(id)
    return { kind: 'creation', campaignId: id, phase: 'complete' }
  }

  private replaceCampaignFromStage(
    id: string,
    name: string,
    previousActiveId: string | null
  ): CampaignDirectoryTransitionReceipt {
    const previousName = this.registry.previousName(id)
    let receipt = this.directoryTransition.begin({
      campaignId: id,
      previousName,
      replacementName: name,
      previousActiveId
    })
    // Windows does not allow a directory containing an open SQLite database
    // to be renamed. Release the active handle before beginning the durable
    // directory transition; the catch path reopens the recorded campaign.
    if (previousActiveId === id) {
      this.connections.release(id)
    }
    try {
      this.onReplacePhase?.('before-original-move')
      receipt = this.directoryTransition.moveOriginal(receipt)
      this.onReplacePhase?.('after-original-move')
      this.onReplacePhase?.('before-replacement-promote')
      receipt = this.directoryTransition.promoteReplacement(receipt)
      this.onReplacePhase?.('after-replacement-promote')
      this.onReplacePhase?.('before-replacement-open')
      this.switchActiveCampaign(id)
      if (
        this.connections.visit((database) =>
          database.pragma('quick_check', { simple: true })
        ) !== 'ok'
      )
        throw new Error('Promoted campaign failed quick_check')
      this.onReplacePhase?.('after-replacement-open')
      this.onReplacePhase?.('before-registry-commit')
      this.registry.commitReplacement(receipt, name)
      receipt = this.directoryTransition.markVerified(receipt)
      this.onReplacePhase?.('after-registry-commit')
      this.onReplacePhase?.('before-cleanup')
      receipt = this.directoryTransition.completeFilesystem(receipt)
      this.onReplacePhase?.('after-cleanup')
      this.directoryTransition.finish(receipt)
      this.clearTransitionCommit(receipt)
      return receipt
    } catch (error) {
      // switchActiveCampaign may already have opened the replacement. Close it
      // before removing or renaming either directory on Windows.
      this.connections.close()
      this.recoverCampaignDirectoryTransition(receipt)
      throw error
    }
  }

  private recoverIncompleteCreations(): void {
    for (const id of this.registry.creatingIds()) {
      if (!this.isSafeCampaignId(id)) {
        this.registry.removeIncompleteCreation(id)
        continue
      }
      try {
        this.finalizeCampaignCreation(id)
      } catch {
        this.removeIncompleteCreation(id)
      }
    }
  }

  private recoverCampaignDirectoryTransitions(): void {
    for (const receipt of this.directoryTransition.receipts())
      this.recoverCampaignDirectoryTransition(receipt, false)

    const replacingParent = join(this.dataRoot, 'campaigns', '.replacing')
    if (existsSync(replacingParent))
      for (const id of readdirSync(replacingParent)) {
        if (!this.isSafeCampaignId(id)) continue
        if (this.directoryTransition.receipt(id) === null)
          this.directoryTransition.recoverLegacy(id)
      }

    const deletingParent = join(this.dataRoot, 'campaigns', '.deleting')
    if (existsSync(deletingParent))
      for (const id of readdirSync(deletingParent)) {
        if (!this.isSafeCampaignId(id)) continue
        this.registry.delete(id)
        rmSync(this.deletingDirectory(id), { recursive: true, force: true })
      }

    for (const id of this.registry.trashedIds()) {
      if (!this.isSafeCampaignId(id))
        throw new Error('Unsafe campaign identifier in trash registry')
      const source = this.campaignDirectory(id)
      const destination = this.trashDirectory(id)
      if (existsSync(source) && existsSync(destination))
        throw new Error('Campaign exists in both active and trash storage')
      this.moveDirectory(source, destination)
    }
  }

  private recoverCampaignDirectoryTransition(
    receipt: CampaignDirectoryTransitionReceipt,
    reopen = true
  ): void {
    if (this.registry.replacementCommit(receipt)) {
      this.directoryTransition.rollForwardFilesystem(receipt)
      this.directoryTransition.finish(receipt)
      this.clearTransitionCommit(receipt)
      if (reopen) this.switchActiveCampaign(receipt.campaignId)
      return
    }

    this.directoryTransition.rollbackFilesystem(receipt)
    this.registry.restoreReplacementRegistry(receipt)
    this.directoryTransition.finish(receipt)
    if (reopen && receipt.previousActiveId !== null)
      this.switchActiveCampaign(receipt.previousActiveId)
  }

  private clearTransitionCommit(
    receipt: CampaignDirectoryTransitionReceipt
  ): void {
    this.registry.clearReplacementCommit(receipt)
  }

  private removeIncompleteCreation(id: string): void {
    rmSync(this.stagedCampaignDirectory(id), { recursive: true, force: true })
    rmSync(this.campaignDirectory(id), { recursive: true, force: true })
    try {
      rmdirSync(join(this.dataRoot, 'campaigns', '.creating'))
    } catch {
      // Another incomplete creation may still own the shared staging parent.
    }
    this.registry.removeIncompleteCreation(id)
  }

  private isValidCampaignStore(path: string): boolean {
    if (!existsSync(path)) return false
    let campaign: Database.Database | undefined
    try {
      campaign = new Database(path, { readonly: true })
      assertSchemaVersion(campaign, undefined, 'campaign')
      return (
        campaign
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'campaign_runtime'"
          )
          .get() !== undefined &&
        campaign.pragma('quick_check', { simple: true }) === 'ok'
      )
    } catch {
      return false
    } finally {
      campaign?.close()
    }
  }

  private campaignDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', id)
  }

  private trashDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.trash', id)
  }

  private deletingDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.deleting', id)
  }

  private stagedCampaignDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.creating', id)
  }

  private campaignPath(id: string): string {
    return join(this.campaignDirectory(id), 'campaign.sqlite')
  }

  private stagedCampaignPath(id: string): string {
    return join(this.stagedCampaignDirectory(id), 'campaign.sqlite')
  }

  private isSafeCampaignId(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  }

  private requireSafeCampaignId(id: string): void {
    if (!this.isSafeCampaignId(id))
      throw new CapabilityError('validation_failed', false)
  }

  private moveDirectory(source: string, destination: string): void {
    const sourceExists = existsSync(source)
    const destinationExists = existsSync(destination)
    if (!sourceExists && destinationExists) return
    if (!sourceExists || destinationExists)
      throw new Error('Campaign directory transition is inconsistent')
    mkdirSync(dirname(destination), { recursive: true })
    renameSync(source, destination)
  }

  private openRecordedActiveCampaign(): void {
    const id = this.list().activeCampaignId
    if (id !== null) {
      this.switchActiveCampaign(id)
      return
    }
    this.registry.clearRecordedActive()
  }

  private switchActiveCampaign(id: string): void {
    this.connections.switch({
      id,
      databasePath: this.campaignPath(id),
      dataPath: this.campaignDirectory(id)
    })
  }
}

/** The caller owns the data-retention decision; paths never imply policy. */
export function openCampaignStore(
  dataRoot: string,
  incompatibleDataPolicy: IncompatibleDataPolicy
): CampaignStore {
  try {
    return new CampaignStore(dataRoot)
  } catch (error) {
    if (!(error instanceof IncompatibleDataError)) throw error
    if (incompatibleDataPolicy === 'preserve') throw error
    rmSync(dataRoot, { recursive: true, force: true })
    console.info(
      JSON.stringify({
        component: 'campaign-store',
        event: 'schema-reset',
        schemaVersions: databaseSchemaVersions
      })
    )
    return new CampaignStore(dataRoot)
  }
}
