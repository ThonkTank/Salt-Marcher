import type { GeneratorPresetCapability } from '../../../shared/contracts/capability-api.js'
import type {
  AssignGeneratorPresetReceipt,
  CreateGeneratorPresetReceipt,
  DeleteGeneratorPresetReceipt,
  GeneratorPresetAssignmentProjection,
  GeneratorPresetConfigV3,
  GeneratorPresetCommandReceipt,
  GeneratorPresetEditorSnapshot,
  GeneratorPresetRegistry,
  UpdateGeneratorPresetReceipt
} from '../../../shared/contracts/generator-presets.js'
import { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import {
  KeyedWriteCommandOwner,
  type KeyedWriteCommandOutcome
} from '../../async/keyed-write-command-owner.js'

type MutationResult<T extends GeneratorPresetCommandReceipt> = Readonly<{
  receipt: T
  snapshot: GeneratorPresetEditorSnapshot
}>

export type GeneratorPresetApplicationPort = Readonly<{
  read: () => Promise<GeneratorPresetEditorSnapshot>
  create: (
    name: string,
    config: GeneratorPresetConfigV3
  ) => Promise<MutationResult<CreateGeneratorPresetReceipt>>
  update: (
    id: string,
    name: string,
    config: GeneratorPresetConfigV3
  ) => Promise<MutationResult<UpdateGeneratorPresetReceipt>>
  delete: (id: string) => Promise<MutationResult<DeleteGeneratorPresetReceipt>>
  assign: (
    presetId: string | null
  ) => Promise<MutationResult<AssignGeneratorPresetReceipt>>
  reconciliationPending: () => boolean
  reconcile: () => Promise<MutationResult<GeneratorPresetCommandReceipt>>
}>

export type GeneratorPresetApplicationLoader = (
  campaignId: string | null
) => Promise<GeneratorPresetApplicationPort>

type AcceptedAssignment = Readonly<{
  registryRevision: number
  value: GeneratorPresetAssignmentProjection
}>

type PendingReconciliation = Readonly<{
  commandId: string
  reconcile: () => Promise<MutationResult<GeneratorPresetCommandReceipt>>
}>

const authority = Object.freeze({
  scope: 'installation.generator-presets' as const,
  entityKey: null
})

export class GeneratorPresetReconciliationPendingError extends Error {
  public readonly commandId: string

  public constructor(commandId: string, cause?: unknown) {
    super('Das Speicherergebnis muss über den Befehlsbeleg geprüft werden.', {
      cause
    })
    this.name = 'GeneratorPresetReconciliationPendingError'
    this.commandId = commandId
  }
}

/**
 * One Workspace-lived application owner for the installation registry. Ports
 * retain Campaign context while sharing registry acceptance and reconciliation.
 */
export class GeneratorPresetApplicationOwner {
  readonly #capability: GeneratorPresetCapability
  readonly #commands: KeyedWriteCommandOwner
  readonly #assignments = new Map<string, AcceptedAssignment>()
  #registry: GeneratorPresetRegistry | null = null
  #pending: PendingReconciliation | null = null

  public constructor(capability: GeneratorPresetCapability) {
    this.#capability = capability
    this.#commands = new KeyedWriteCommandOwner(new AsyncCommandCoordinator())
  }

  public port(campaignId: string | null): GeneratorPresetApplicationPort {
    return Object.freeze({
      read: () => this.#read(campaignId),
      create: (name, config) => this.#create(campaignId, name, config),
      update: (id, name, config) => this.#update(campaignId, id, name, config),
      delete: (id) => this.#delete(campaignId, id),
      assign: (presetId) => this.#assign(campaignId, presetId),
      reconciliationPending: () => this.#pending !== null,
      reconcile: () => this.#reconcile()
    })
  }

  public dispose(): void {
    this.#pending = null
    this.#commands.dispose()
  }

  async #read(
    campaignId: string | null
  ): Promise<GeneratorPresetEditorSnapshot> {
    if (
      this.#pending &&
      this.#registry &&
      (campaignId === null || this.#assignments.has(campaignId))
    )
      return this.#snapshot(campaignId)
    const snapshot = await this.#capability.readEditor({ campaignId })
    this.#acceptSnapshot(snapshot)
    return this.#snapshot(campaignId)
  }

  async #create(
    campaignId: string | null,
    name: string,
    config: GeneratorPresetConfigV3
  ): Promise<MutationResult<CreateGeneratorPresetReceipt>> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority,
        commandId,
        command: this.#capability.create,
        receiptRead: this.#capability.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#revision(campaignId),
          name,
          config
        }),
      readReceipt: (operation, id) => operation({ commandId: id }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'created' ? receipt : null,
      accept: (receipt) => this.#acceptReceipt(receipt)
    })
    return this.#settle(outcome, campaignId)
  }

  async #update(
    campaignId: string | null,
    id: string,
    name: string,
    config: GeneratorPresetConfigV3
  ): Promise<MutationResult<UpdateGeneratorPresetReceipt>> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority,
        commandId,
        command: this.#capability.update,
        receiptRead: this.#capability.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#revision(campaignId),
          id,
          name,
          config
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'updated' ? receipt : null,
      accept: (receipt) => this.#acceptReceipt(receipt)
    })
    return this.#settle(outcome, campaignId)
  }

  async #delete(
    campaignId: string | null,
    id: string
  ): Promise<MutationResult<DeleteGeneratorPresetReceipt>> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority,
        commandId,
        command: this.#capability.delete,
        receiptRead: this.#capability.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#revision(campaignId),
          id
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'deleted' ? receipt : null,
      accept: (receipt) => this.#acceptReceipt(receipt)
    })
    return this.#settle(outcome, campaignId)
  }

  async #assign(
    campaignId: string | null,
    presetId: string | null
  ): Promise<MutationResult<AssignGeneratorPresetReceipt>> {
    if (!campaignId) throw new Error('No active campaign.')
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority,
        commandId,
        command: this.#capability.assign,
        receiptRead: this.#capability.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#revision(campaignId),
          campaignId,
          presetId
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'assigned' ? receipt : null,
      accept: (receipt) => this.#acceptReceipt(receipt)
    })
    return this.#settle(outcome, campaignId)
  }

  async #revision(campaignId: string | null): Promise<number> {
    if (!this.#registry) await this.#read(campaignId)
    if (!this.#registry)
      throw new Error('Generator preset registry is missing.')
    return this.#registry.revision
  }

  #acceptSnapshot(snapshot: GeneratorPresetEditorSnapshot): void {
    const currentRevision = this.#registry?.revision ?? -1
    if (snapshot.registry.revision >= currentRevision)
      this.#registry = snapshot.registry
    const assignment = snapshot.assignment
    if (!assignment) return
    const current = this.#assignments.get(assignment.campaignId)
    if (!current || snapshot.registry.revision >= current.registryRevision)
      this.#assignments.set(
        assignment.campaignId,
        Object.freeze({
          registryRevision: snapshot.registry.revision,
          value: assignment
        })
      )
  }

  #acceptReceipt(receipt: GeneratorPresetCommandReceipt): void {
    if (!this.#registry || receipt.registry.revision >= this.#registry.revision)
      this.#registry = receipt.registry
    if (receipt.kind === 'assigned')
      this.#assignments.set(
        receipt.assignment.campaignId,
        Object.freeze({
          registryRevision: receipt.registry.revision,
          value: receipt.assignment
        })
      )
    if (receipt.kind !== 'deleted') return
    const fallback = receipt.registry.presets.find((preset) => preset.protected)
    if (!fallback) return
    for (const affectedCampaignId of receipt.affectedCampaignIds)
      this.#assignments.set(
        affectedCampaignId,
        Object.freeze({
          registryRevision: receipt.registry.revision,
          value: Object.freeze({
            campaignId: affectedCampaignId,
            assignedPresetId: null,
            effectivePresetId: fallback.id
          })
        })
      )
  }

  #snapshot(campaignId: string | null): GeneratorPresetEditorSnapshot {
    if (!this.#registry)
      throw new Error('Generator preset registry is missing.')
    return Object.freeze({
      registry: this.#registry,
      assignment: campaignId
        ? (this.#assignments.get(campaignId)?.value ?? null)
        : null
    })
  }

  #settle<T extends GeneratorPresetCommandReceipt>(
    outcome: KeyedWriteCommandOutcome<T>,
    campaignId: string | null
  ): MutationResult<T> {
    switch (outcome.status) {
      case 'success':
        if (this.#pending?.commandId === outcome.value.commandId)
          this.#pending = null
        return Object.freeze({
          receipt: outcome.value,
          snapshot: this.#snapshot(campaignId)
        })
      case 'reconciliation-pending': {
        const pending: PendingReconciliation = Object.freeze({
          commandId: outcome.commandId,
          reconcile: async () => this.#settle(await outcome.retry(), campaignId)
        })
        this.#pending = pending
        throw new GeneratorPresetReconciliationPendingError(
          outcome.commandId,
          outcome.cause
        )
      }
      case 'blocked':
        throw new GeneratorPresetReconciliationPendingError(
          outcome.pendingCommandId
        )
      case 'failure':
        if (this.#pending) this.#pending = null
        throw outcome.cause
      case 'stale':
        if (this.#pending) this.#pending = null
        throw new Error(`Generator preset command was ${outcome.reason}.`)
    }
  }

  #reconcile(): Promise<MutationResult<GeneratorPresetCommandReceipt>> {
    if (!this.#pending)
      return Promise.reject(
        new Error('No generator preset receipt is pending.')
      )
    return this.#pending.reconcile()
  }
}

export function createGeneratorPresetApplicationOwner(
  capability: GeneratorPresetCapability
): GeneratorPresetApplicationOwner {
  return new GeneratorPresetApplicationOwner(capability)
}
