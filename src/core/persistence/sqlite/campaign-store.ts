import Database from 'better-sqlite3'
import {
  activateCampaignReceiptSchema,
  createCampaignReceiptSchema,
  deleteCampaignReceiptSchema,
  freezeCampaignSnapshot,
  renameCampaignReceiptSchema,
  restoreCampaignReceiptSchema,
  trashCampaignReceiptSchema,
  type ActivateCampaignCommand,
  type ActivateCampaignReceipt,
  type CampaignCommandReceipt,
  type CampaignIdCommand,
  type CampaignSnapshot,
  type CreateCampaignCommand,
  type CreateCampaignReceipt,
  type DeleteCampaignCommand,
  type DeleteCampaignReceipt,
  type RenameCampaignCommand,
  type RenameCampaignReceipt,
  type RestoreCampaignReceipt,
  type TrashCampaignReceipt
} from '../../../shared/contracts/campaign.js'
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
import type { CampaignCommandIdentity } from './campaign-registry-repository.js'

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

  create(input: CreateCampaignCommand): CreateCampaignReceipt
  create(name: string, expectedRevision?: number): CampaignSnapshot
  create(
    inputOrName: CreateCampaignCommand | string,
    legacyExpectedRevision = this.list().revision
  ): CreateCampaignReceipt | CampaignSnapshot {
    const input = typeof inputOrName === 'string' ? null : inputOrName
    const name = input?.name ?? (inputOrName as string)
    const expectedRevision =
      input?.expectedRegistryRevision ?? legacyExpectedRevision
    const requestJson = input ? commandRequestJson('created', { name }) : null
    if (input && requestJson) {
      const existing =
        this.installationOwner.registry.existingCommandForRequest(
          input.commandId,
          'created',
          requestJson
        )
      if (existing)
        return freezeReceipt(createCampaignReceiptSchema.parse(existing))
    }
    this.installationOwner.registry.assertRevision(expectedRevision)
    const id = uuidv7()
    const command =
      input && requestJson
        ? commandIdentity(input.commandId, 'created', requestJson, id)
        : undefined
    const createdAt = new Date().toISOString()
    this.onCreatePhase?.('before-registry-entry')
    this.installationOwner.registry.beginCreation(
      id,
      name,
      createdAt,
      expectedRevision,
      command
    )
    this.onCreatePhase?.('after-creating-entry')
    this.createStagedCampaignStore(id)
    this.onCreatePhase?.('after-store-created')
    const receipt = this.finalizeCampaignCreation(id, expectedRevision, command)
    return command
      ? freezeReceipt(createCampaignReceiptSchema.parse(receipt))
      : this.list()
  }

  activate(input: ActivateCampaignCommand): ActivateCampaignReceipt
  activate(id: string, expectedRevision?: number): CampaignSnapshot
  activate(
    inputOrId: ActivateCampaignCommand | string,
    legacyExpectedRevision = this.list().revision
  ): ActivateCampaignReceipt | CampaignSnapshot {
    const input = typeof inputOrId === 'string' ? null : inputOrId
    const id = input?.id ?? (inputOrId as string)
    const expectedRevision =
      input?.expectedRegistryRevision ?? legacyExpectedRevision
    const command = input
      ? this.commandIdentity(input.commandId, 'activated', { id }, id)
      : undefined
    const existing = command
      ? this.installationOwner.registry.existingCommand(command)
      : null
    if (existing)
      return freezeReceipt(activateCampaignReceiptSchema.parse(existing))
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireAvailable(id)
    const previousActiveId = this.list().activeCampaignId
    this.switchActiveCampaign(id)
    let receipt: CampaignCommandReceipt | null
    try {
      receipt = this.installationOwner.registry.setActive(
        id,
        expectedRevision,
        command
      )
    } catch (cause) {
      this.restoreActiveConnectionAfterFailedSwitch(previousActiveId, id)
      throw cause
    }
    return command
      ? freezeReceipt(activateCampaignReceiptSchema.parse(receipt))
      : this.list()
  }

  rename(input: RenameCampaignCommand): RenameCampaignReceipt
  rename(id: string, name: string, expectedRevision?: number): CampaignSnapshot
  rename(
    inputOrId: RenameCampaignCommand | string,
    legacyName?: string,
    legacyExpectedRevision = this.list().revision
  ): RenameCampaignReceipt | CampaignSnapshot {
    const input = typeof inputOrId === 'string' ? null : inputOrId
    const id = input?.id ?? (inputOrId as string)
    const name = input?.name ?? legacyName!
    const expectedRevision =
      input?.expectedRegistryRevision ?? legacyExpectedRevision
    const command = input
      ? this.commandIdentity(input.commandId, 'renamed', { id, name }, id)
      : undefined
    const existing = command
      ? this.installationOwner.registry.existingCommand(command)
      : null
    if (existing)
      return freezeReceipt(renameCampaignReceiptSchema.parse(existing))
    const receipt = this.installationOwner.registry.rename(
      id,
      name,
      expectedRevision,
      command
    )
    return command
      ? freezeReceipt(renameCampaignReceiptSchema.parse(receipt))
      : this.list()
  }

  trash(input: CampaignIdCommand): TrashCampaignReceipt
  trash(id: string, expectedRevision?: number): CampaignSnapshot
  trash(
    inputOrId: CampaignIdCommand | string,
    legacyExpectedRevision = this.list().revision
  ): TrashCampaignReceipt | CampaignSnapshot {
    const input = typeof inputOrId === 'string' ? null : inputOrId
    const id = input?.id ?? (inputOrId as string)
    const expectedRevision =
      input?.expectedRegistryRevision ?? legacyExpectedRevision
    const command = input
      ? this.commandIdentity(input.commandId, 'trashed', { id }, id)
      : undefined
    const existing = command
      ? this.installationOwner.registry.existingCommand(command)
      : null
    if (existing)
      return freezeReceipt(trashCampaignReceiptSchema.parse(existing))
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireAvailable(id)

    if (this.list().activeCampaignId === id) {
      this.connections.release(id)
    }
    const receipt = this.installationOwner.registry.trash(
      id,
      new Date().toISOString(),
      expectedRevision,
      command
    )
    this.filesystem.moveCampaignToTrash(id)
    return command
      ? freezeReceipt(trashCampaignReceiptSchema.parse(receipt))
      : this.list()
  }

  restore(input: CampaignIdCommand): RestoreCampaignReceipt
  restore(id: string, expectedRevision?: number): CampaignSnapshot
  restore(
    inputOrId: CampaignIdCommand | string,
    legacyExpectedRevision = this.list().revision
  ): RestoreCampaignReceipt | CampaignSnapshot {
    const input = typeof inputOrId === 'string' ? null : inputOrId
    const id = input?.id ?? (inputOrId as string)
    const expectedRevision =
      input?.expectedRegistryRevision ?? legacyExpectedRevision
    const command = input
      ? this.commandIdentity(input.commandId, 'restored', { id }, id)
      : undefined
    const existing = command
      ? this.installationOwner.registry.existingCommand(command)
      : null
    if (existing)
      return freezeReceipt(restoreCampaignReceiptSchema.parse(existing))
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireTrashed(id)

    this.filesystem.restoreCampaignFromTrash(id)
    const receipt = this.installationOwner.registry.restore(
      id,
      expectedRevision,
      command
    )
    return command
      ? freezeReceipt(restoreCampaignReceiptSchema.parse(receipt))
      : this.list()
  }

  deleteForever(input: DeleteCampaignCommand): DeleteCampaignReceipt
  deleteForever(
    id: string,
    confirmationName: string,
    expectedRevision?: number
  ): CampaignSnapshot
  deleteForever(
    inputOrId: DeleteCampaignCommand | string,
    legacyConfirmationName?: string,
    legacyExpectedRevision = this.list().revision
  ): DeleteCampaignReceipt | CampaignSnapshot {
    const input = typeof inputOrId === 'string' ? null : inputOrId
    const id = input?.id ?? (inputOrId as string)
    const confirmationName = input?.confirmationName ?? legacyConfirmationName!
    const expectedRevision =
      input?.expectedRegistryRevision ?? legacyExpectedRevision
    const command = input
      ? this.commandIdentity(
          input.commandId,
          'deleted',
          { id, confirmationName },
          id
        )
      : undefined
    const existing = command
      ? this.installationOwner.registry.existingCommand(command)
      : null
    if (existing)
      return freezeReceipt(deleteCampaignReceiptSchema.parse(existing))
    this.requireSafeCampaignId(id)
    this.installationOwner.registry.assertRevision(expectedRevision)
    this.installationOwner.registry.requireDeletionName(id, confirmationName)

    this.filesystem.stageTrashForDeletion(id)
    const receipt = this.installationOwner.registry.delete(
      id,
      expectedRevision,
      command
    )
    this.filesystem.finishDeletion(id)
    return command
      ? freezeReceipt(deleteCampaignReceiptSchema.parse(receipt))
      : this.list()
  }

  commandReceipt(commandId: string): CampaignCommandReceipt | null {
    return this.installationOwner.registry.commandReceipt(commandId)
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
    expectedRevision = this.list().revision,
    command?: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    this.filesystem.promoteStagedCreation(id)
    this.onCreatePhase?.('before-ready')
    const previousActiveId = this.list().activeCampaignId
    this.switchActiveCampaign(id)
    try {
      return this.installationOwner.registry.markReadyAndActivate(
        id,
        expectedRevision,
        command
      )
    } catch (cause) {
      this.restoreActiveConnectionAfterFailedSwitch(previousActiveId, id)
      throw cause
    }
  }

  private recoverIncompleteCreations(): void {
    for (const id of this.installationOwner.registry.creatingIds()) {
      if (!isSafeCampaignId(id)) {
        this.installationOwner.registry.removeIncompleteCreation(id)
        continue
      }
      try {
        this.finalizeCampaignCreation(
          id,
          this.list().revision,
          this.installationOwner.registry.pendingCreationCommand(id) ??
            undefined
        )
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

  private commandIdentity(
    commandId: string,
    kind: CampaignCommandReceipt['kind'],
    request: Readonly<Record<string, string>>,
    campaignId: string
  ): CampaignCommandIdentity {
    return commandIdentity(
      commandId,
      kind,
      commandRequestJson(kind, request),
      campaignId
    )
  }

  private restoreActiveConnectionAfterFailedSwitch(
    previousActiveId: string | null,
    attemptedId: string
  ): void {
    if (previousActiveId === attemptedId) return
    if (previousActiveId === null) {
      this.connections.release(attemptedId)
      return
    }
    this.switchActiveCampaign(previousActiveId)
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

function commandIdentity(
  commandId: string,
  kind: CampaignCommandReceipt['kind'],
  requestJson: string,
  campaignId: string
): CampaignCommandIdentity {
  return Object.freeze({ commandId, kind, requestJson, campaignId })
}

function commandRequestJson(
  kind: CampaignCommandReceipt['kind'],
  request: Readonly<Record<string, string>>
): string {
  return JSON.stringify({ kind, ...request })
}

function freezeReceipt<Receipt extends CampaignCommandReceipt>(
  receipt: Receipt
): Receipt {
  return Object.freeze({
    ...receipt,
    snapshot: freezeCampaignSnapshot(receipt.snapshot)
  }) as Receipt
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
