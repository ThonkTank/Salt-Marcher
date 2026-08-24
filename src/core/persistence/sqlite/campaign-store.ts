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
  CampaignLifecycleCoordinator,
  type CampaignLifecycleBoundary,
  type CampaignLifecycleOperation,
  type CampaignLifecyclePhase,
  type CampaignLifecycleReceipt
} from '../../application/campaign-lifecycle-coordinator.js'
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
import { FileCampaignLifecycleJournal } from './campaign-lifecycle-journal.js'
import { InstallationDatabaseOwner } from './installation-database-owner.js'

export type CampaignCreatePhase =
  | 'before-registry-entry'
  | 'after-creating-entry'
  | 'after-store-created'
  | 'before-ready'

export interface CampaignStoreOptions {
  /** Test seam for simulating a process interruption at durable create boundaries. */
  onCreatePhase?: (phase: CampaignCreatePhase) => void
  /** Failure-injection seam after a persisted Campaign lifecycle phase. */
  onLifecyclePhase?: (
    phase: CampaignLifecyclePhase,
    receipt: CampaignLifecycleReceipt
  ) => void
  /** Failure-injection seam at real cross-resource transition boundaries. */
  onLifecycleBoundary?: (boundary: CampaignLifecycleBoundary) => void
  schemaBootstrapper?: CampaignSchemaBootstrapper
}

export interface ImportedCampaignLifecycleOptions<T> {
  readonly operation?: CampaignLifecycleOperation
  readonly verifyPublished?: (
    database: Database.Database,
    stagedEvidence: T
  ) => boolean
  readonly onPhase?: (
    phase: CampaignLifecyclePhase,
    receipt: CampaignLifecycleReceipt
  ) => void
  readonly onBoundary?: (boundary: CampaignLifecycleBoundary) => void
}

export class CampaignStore {
  private readonly installationOwner: InstallationDatabaseOwner
  private readonly connections = new CampaignConnectionManager()
  private readonly onCreatePhase:
    ((phase: CampaignCreatePhase) => void) | undefined
  private readonly onLifecyclePhase:
    CampaignStoreOptions['onLifecyclePhase'] | undefined
  private readonly onLifecycleBoundary:
    CampaignStoreOptions['onLifecycleBoundary'] | undefined
  private readonly lifecycle: CampaignLifecycleCoordinator
  private readonly filesystem: CampaignFilesystem
  private readonly activePersistence: SqliteDatabaseAccess

  constructor(dataRoot: string, options: CampaignStoreOptions = {}) {
    this.onCreatePhase = options.onCreatePhase
    this.onLifecyclePhase = options.onLifecyclePhase
    this.onLifecycleBoundary = options.onLifecycleBoundary
    this.activePersistence = sqliteDatabaseAccess((visitor) =>
      this.connections.visit(visitor)
    )
    const schemaBootstrapper =
      options.schemaBootstrapper ?? createDefaultCampaignSchemaBootstrapper()
    this.filesystem = new CampaignFilesystem(dataRoot, schemaBootstrapper)
    this.installationOwner = new InstallationDatabaseOwner(dataRoot)
    this.lifecycle = new CampaignLifecycleCoordinator({
      journal: new FileCampaignLifecycleJournal(dataRoot),
      storage: this.filesystem,
      connections: {
        release: (campaignId) => {
          this.connections.release(campaignId)
        },
        close: () => this.connections.close(),
        reopen: (campaignId) => this.switchActiveCampaign(campaignId)
      },
      registration: this.installationOwner.campaignLifecycleRegistration()
    })
    try {
      this.lifecycle.recoverPending(false)
      this.recoverIncompleteCreations()
      this.recoverCampaignStorage()
      this.openRecordedActiveCampaign()
    } catch (error) {
      this.installationOwner.close()
      throw error
    }
  }

  list(): CampaignSnapshot {
    return this.installationOwner.registry.snapshot()
  }

  create(
    name: string,
    expectedRevision = this.list().revision
  ): CampaignSnapshot {
    this.installationOwner.registry.assertRevision(expectedRevision)
    const id = uuidv7()
    const createdAt = new Date().toISOString()
    this.onCreatePhase?.('before-registry-entry')
    this.installationOwner.registry.beginCreation(
      id,
      name,
      createdAt,
      expectedRevision
    )
    this.onCreatePhase?.('after-creating-entry')
    this.createStagedCampaignStore(id)
    this.onCreatePhase?.('after-store-created')
    this.finalizeCampaignCreation(id, expectedRevision)
    return this.list()
  }

  activate(
    id: string,
    expectedRevision = this.list().revision
  ): CampaignSnapshot {
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireAvailable(id)
    this.switchActiveCampaign(id)
    this.installationOwner.registry.setActive(id, expectedRevision)
    return this.list()
  }

  rename(
    id: string,
    name: string,
    expectedRevision = this.list().revision
  ): CampaignSnapshot {
    this.installationOwner.registry.rename(id, name, expectedRevision)
    return this.list()
  }

  trash(id: string, expectedRevision = this.list().revision): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireAvailable(id)

    if (this.list().activeCampaignId === id) {
      this.connections.release(id)
    }
    this.installationOwner.registry.trash(
      id,
      new Date().toISOString(),
      expectedRevision
    )
    this.filesystem.moveCampaignToTrash(id)
    return this.list()
  }

  restore(
    id: string,
    expectedRevision = this.list().revision
  ): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireTrashed(id)

    this.filesystem.restoreCampaignFromTrash(id)
    this.installationOwner.registry.restore(id, expectedRevision)
    return this.list()
  }

  deleteForever(
    id: string,
    confirmationName: string,
    expectedRevision = this.list().revision
  ): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireDeletionName(id, confirmationName)

    this.filesystem.stageTrashForDeletion(id)
    this.installationOwner.registry.delete(id, expectedRevision)
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
    reservedId?: string,
    lifecycleOptions: ImportedCampaignLifecycleOptions<T> = {}
  ): Readonly<{
    campaignId: string
    snapshot: CampaignSnapshot
    quickCheck: 'ok'
    evidence: T
    campaignLifecycle: CampaignLifecycleReceipt
  }> {
    const id = existingId ?? reservedId ?? uuidv7()
    if (reservedId !== undefined) this.requireSafeCampaignId(reservedId)
    if (existingId !== null) this.requireSafeCampaignId(existingId)
    const previousActiveId = this.list().activeCampaignId
    const createdAt = new Date().toISOString()
    const previousName =
      existingId === null
        ? null
        : this.installationOwner.registry.previousName(id)
    const operation = lifecycleOptions.operation ?? { kind: 'replacement' }
    const execution = this.lifecycle.execute({
      input: {
        operation,
        mode: existingId === null ? 'create' : 'replace',
        campaignId: id,
        previousName,
        replacementName: name,
        previousActiveId
      },
      stage: () => {
        this.filesystem.discardStagedCampaign(id)
        if (existingId === null) {
          this.installationOwner.registry.insertImportCreation(
            id,
            name,
            createdAt
          )
          this.createStagedCampaignStore(id)
        } else this.cloneCampaignToStage(id)
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
          return Object.freeze({ evidence, quickCheck: 'ok' as const })
        } finally {
          staged.close()
        }
      },
      validate: (staged) => {
        if (
          !this.filesystem.isValidCampaignStore(
            this.filesystem.stagedCampaignPath(id)
          )
        )
          throw new Error('Imported campaign failed staged store validation')
        return staged
      },
      verify: (staged) =>
        this.connections.visit(
          (database) =>
            database.pragma('quick_check', { simple: true }) === 'ok' &&
            (lifecycleOptions.verifyPublished?.(database, staged.evidence) ??
              true)
        ),
      result: (staged) => staged,
      onPhase: (phase, receipt) => {
        this.onLifecyclePhase?.(phase, receipt)
        lifecycleOptions.onPhase?.(phase, receipt)
      },
      onBoundary: (boundary) => {
        this.onLifecycleBoundary?.(boundary)
        lifecycleOptions.onBoundary?.(boundary)
      }
    })
    return {
      campaignId: id,
      snapshot: this.list(),
      quickCheck: execution.result.quickCheck,
      evidence: execution.result.evidence,
      campaignLifecycle: execution.receipt
    }
  }

  campaignImportRepository(): CampaignImportStore {
    return this.installationOwner.campaignImports
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

  private finalizeCampaignCreation(
    id: string,
    expectedRevision = this.list().revision
  ): void {
    this.filesystem.promoteStagedCreation(id)
    this.onCreatePhase?.('before-ready')
    this.installationOwner.registry.markReadyAndActivate(id, expectedRevision)
    this.switchActiveCampaign(id)
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

  private recoverCampaignStorage(): void {
    for (const id of this.filesystem.legacyReplacementIds()) {
      if (!isSafeCampaignId(id)) continue
      if (!this.lifecycle.hasPending(id))
        this.lifecycle.recoverLegacyReplacement(id)
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
