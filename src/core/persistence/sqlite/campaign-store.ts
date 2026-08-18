import Database from 'better-sqlite3'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'
import {
  assertSchemaVersion,
  configureSqlite,
  databaseSchemaVersions,
  IncompatibleDataError
} from './database.js'
import {
  type InstallationPreferencesPatch,
  type InstallationSettings
} from '../../../shared/contracts/settings.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import type { IncompatibleDataPolicy } from '../../../shared/contracts/runtime.js'
import type { CampaignImportStore } from '../../campaign-import/campaign-import-store.js'
import {
  CampaignDirectoryTransition,
  type CampaignDirectoryTransitionReceipt
} from './campaign-directory-transition.js'
import { CampaignConnectionManager } from './campaign-connection-manager.js'
import {
  type CampaignSchemaBootstrapper,
  createDefaultCampaignSchemaBootstrapper
} from './campaign-schema-bootstrapper.js'
import {
  sqliteDatabaseAccess,
  type SqliteDatabaseAccess
} from './database-access.js'
import {
  CampaignFilesystem,
  isSafeCampaignId,
  resetPersistenceRoot
} from './campaign-filesystem.js'
import { InstallationDatabaseOwner } from './installation-database-owner.js'

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
  private readonly installationOwner: InstallationDatabaseOwner
  private readonly connections = new CampaignConnectionManager()
  private readonly onCreatePhase:
    ((phase: CampaignCreatePhase) => void) | undefined
  private readonly onReplacePhase:
    ((phase: CampaignReplacePhase) => void) | undefined
  private readonly directoryTransition: CampaignDirectoryTransition
  private readonly filesystem: CampaignFilesystem
  private readonly activePersistence: SqliteDatabaseAccess

  constructor(dataRoot: string, options: CampaignStoreOptions = {}) {
    this.onCreatePhase = options.onCreatePhase
    this.onReplacePhase = options.onReplacePhase
    this.activePersistence = sqliteDatabaseAccess((visitor) =>
      this.connections.visit(visitor)
    )
    const schemaBootstrapper =
      options.schemaBootstrapper ?? createDefaultCampaignSchemaBootstrapper()
    this.filesystem = new CampaignFilesystem(dataRoot, schemaBootstrapper)
    this.directoryTransition = new CampaignDirectoryTransition(
      dataRoot,
      (path) => this.filesystem.isValidCampaignStore(path)
    )
    this.installationOwner = new InstallationDatabaseOwner(dataRoot)
    try {
      this.recoverIncompleteCreations()
      this.recoverCampaignDirectoryTransitions()
      this.openRecordedActiveCampaign()
    } catch (error) {
      this.installationOwner.close()
      throw error
    }
  }

  list(): CampaignSnapshot {
    return this.installationOwner.registry.snapshot()
  }

  create(name: string): CampaignSnapshot {
    const id = uuidv7()
    const createdAt = new Date().toISOString()
    this.onCreatePhase?.('before-registry-entry')
    this.installationOwner.registry.beginCreation(id, name, createdAt)
    this.onCreatePhase?.('after-creating-entry')
    this.createStagedCampaignStore(id)
    this.onCreatePhase?.('after-store-created')
    this.finalizeCampaignCreation(id)
    return this.list()
  }

  activate(id: string): CampaignSnapshot {
    this.installationOwner.registry.requireAvailable(id)
    this.switchActiveCampaign(id)
    this.installationOwner.registry.setActive(id)
    return this.list()
  }

  rename(id: string, name: string): CampaignSnapshot {
    this.installationOwner.registry.rename(id, name)
    return this.list()
  }

  trash(id: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.requireAvailable(id)

    if (this.list().activeCampaignId === id) {
      this.connections.release(id)
    }
    this.installationOwner.registry.trash(id, new Date().toISOString())
    this.filesystem.moveCampaignToTrash(id)
    return this.list()
  }

  restore(id: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.requireTrashed(id)

    this.filesystem.restoreCampaignFromTrash(id)
    this.installationOwner.registry.restore(id)
    return this.list()
  }

  deleteForever(id: string, confirmationName: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.requireDeletionName(id, confirmationName)

    this.filesystem.stageTrashForDeletion(id)
    this.installationOwner.registry.delete(id)
    this.filesystem.finishDeletion(id)
    return this.list()
  }

  readSettings(): InstallationSettings {
    return this.installationOwner.readSettings()
  }

  updateSettings(
    patch: InstallationPreferencesPatch,
    expectedRevision: number
  ): InstallationSettings {
    return this.installationOwner.updateSettings(patch, expectedRevision)
  }

  close(): void {
    this.connections.close()
    this.installationOwner.close()
  }

  activeCampaignPersistence(): SqliteDatabaseAccess {
    return this.activePersistence
  }

  installationPersistenceAccess(): SqliteDatabaseAccess {
    return this.installationOwner.persistenceAccess()
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
    this.filesystem.discardStagedCampaign(id)
    if (existingId === null)
      this.installationOwner.registry.insertImportCreation(id, name, createdAt)
    try {
      if (existingId === null) this.createStagedCampaignStore(id)
      else this.cloneCampaignToStage(id)
      const staged = new Database(this.filesystem.stagedCampaignPath(id))
      try {
        configureSqlite(staged)
        assertSchemaVersion(
          staged,
          this.filesystem.stagedCampaignDirectory(id),
          'campaign'
        )
        const evidence = populateAndVerify(staged)
        if (staged.pragma('quick_check', { simple: true }) !== 'ok')
          throw new Error('Imported campaign failed quick_check')
        staged.close()
        if (
          !this.filesystem.isValidCampaignStore(
            this.filesystem.stagedCampaignPath(id)
          )
        )
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
          this.filesystem.isValidCampaignStore(
            this.filesystem.campaignPath(id)
          ))
      )
        this.filesystem.discardStagedCampaign(id)
      if (existingId === null) {
        this.filesystem.discardCurrentCampaign(id)
        this.installationOwner.registry.removeIncompleteCreation(id)
      }
      throw error
    }
  }

  campaignImportRepository(): CampaignImportStore {
    return this.installationOwner.campaignImports
  }

  discardFailedImportedCampaign(
    campaignId: string,
    previousActiveCampaignId: string | null
  ): void {
    this.requireSafeCampaignId(campaignId)
    if (this.connections.activeId() === campaignId)
      this.connections.release(campaignId)
    this.installationOwner.registry.delete(campaignId)
    this.filesystem.discardStagedCampaign(campaignId)
    this.filesystem.discardCurrentCampaign(campaignId)
    if (previousActiveCampaignId !== null) {
      this.installationOwner.registry.requireAvailable(previousActiveCampaignId)
      this.installationOwner.registry.setActive(previousActiveCampaignId)
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
    const rows = this.installationOwner.registry.readyRows()
    return rows.map((row) => {
      if (row.id === activeId && this.connections.activeId() === row.id)
        return this.connections.visit((database) =>
          visitor({
            id: row.id,
            name: row.name,
            trashed: false,
            database
          })
        )
      const path = row.trashedAt
        ? `${this.filesystem.trashDirectory(row.id)}/campaign.sqlite`
        : this.filesystem.campaignPath(row.id)
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
    return this.filesystem.campaignPath(id)
  }

  private createStagedCampaignStore(id: string): void {
    this.filesystem.createStagedCampaign(id)
  }

  private cloneCampaignToStage(id: string): void {
    const borrowedActive = this.connections.activeId() === id
    const copy = (source: Database.Database) =>
      this.filesystem.cloneCampaignToStage(id, source)
    if (borrowedActive) return this.connections.visit(copy)
    const source = new Database(this.filesystem.campaignPath(id))
    try {
      copy(source)
    } finally {
      source.close()
    }
  }

  private finalizeCampaignCreation(id: string): void {
    this.filesystem.promoteStagedCreation(id)
    this.onCreatePhase?.('before-ready')
    this.installationOwner.registry.markReadyAndActivate(id)
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
    const previousName = this.installationOwner.registry.previousName(id)
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
      this.installationOwner.registry.commitReplacement(receipt, name)
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
    for (const id of this.installationOwner.registry.creatingIds()) {
      if (!isSafeCampaignId(id)) {
        this.installationOwner.registry.removeIncompleteCreation(id)
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

    for (const id of this.filesystem.legacyReplacementIds()) {
      if (!isSafeCampaignId(id)) continue
      if (this.directoryTransition.receipt(id) === null)
        this.directoryTransition.recoverLegacy(id)
    }

    for (const id of this.filesystem.pendingDeletionIds()) {
      if (!isSafeCampaignId(id)) continue
      this.installationOwner.registry.delete(id)
      this.filesystem.finishDeletion(id)
    }

    for (const id of this.installationOwner.registry.trashedIds()) {
      if (!isSafeCampaignId(id))
        throw new Error('Unsafe campaign identifier in trash registry')
      this.filesystem.assertAndConvergeTrashedCampaign(id)
    }
  }

  private recoverCampaignDirectoryTransition(
    receipt: CampaignDirectoryTransitionReceipt,
    reopen = true
  ): void {
    if (this.installationOwner.registry.replacementCommit(receipt)) {
      this.directoryTransition.rollForwardFilesystem(receipt)
      this.directoryTransition.finish(receipt)
      this.clearTransitionCommit(receipt)
      if (reopen) this.switchActiveCampaign(receipt.campaignId)
      return
    }

    this.directoryTransition.rollbackFilesystem(receipt)
    this.installationOwner.registry.restoreReplacementRegistry(receipt)
    this.directoryTransition.finish(receipt)
    if (reopen && receipt.previousActiveId !== null)
      this.switchActiveCampaign(receipt.previousActiveId)
  }

  private clearTransitionCommit(
    receipt: CampaignDirectoryTransitionReceipt
  ): void {
    this.installationOwner.registry.clearReplacementCommit(receipt)
  }

  private removeIncompleteCreation(id: string): void {
    this.filesystem.discardIncompleteCampaign(id)
    this.installationOwner.registry.removeIncompleteCreation(id)
  }

  private requireSafeCampaignId(id: string): void {
    if (!isSafeCampaignId(id))
      throw new CapabilityError('validation_failed', false)
  }

  private openRecordedActiveCampaign(): void {
    const id = this.list().activeCampaignId
    if (id !== null) {
      this.switchActiveCampaign(id)
      return
    }
    this.installationOwner.registry.clearRecordedActive()
  }

  private switchActiveCampaign(id: string): void {
    this.connections.switch({
      id,
      databasePath: this.filesystem.campaignPath(id),
      dataPath: this.filesystem.campaignDirectory(id)
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
    resetPersistenceRoot(dataRoot)
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
