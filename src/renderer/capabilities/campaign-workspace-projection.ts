import type {
  CampaignCommandReceipt,
  CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../shared/contracts/live-session.js'
import {
  CapabilityError,
  capabilityErrorCode
} from '../../shared/errors/capability-error.js'
import { AsyncCommandCoordinator } from '../async/async-command-coordinator.js'
import {
  KeyedReadProjectionOwner,
  type ReadProjectionOutcome,
  type ReadProjectionSnapshot
} from '../async/keyed-read-projection-owner.js'
import {
  KeyedWriteCommandOwner,
  type KeyedWriteCommandOutcome
} from '../async/keyed-write-command-owner.js'
import type {
  ReadProjectionExecution,
  RendererAuthorityKey
} from '../async/renderer-execution-contract.js'

export const campaignCatalogAuthority = Object.freeze({
  scope: 'installation.campaign-catalog' as const,
  entityKey: null
})

export function campaignSessionAuthority(
  campaignId: string
): RendererAuthorityKey<'campaign.live-session'> {
  return Object.freeze({
    scope: 'campaign.live-session',
    entityKey: campaignId
  })
}

export type CampaignWorkspaceProjectionSnapshot = Readonly<{
  status: 'idle' | 'pending' | 'ready' | 'failure'
  campaigns: CampaignSnapshot
  sessionCampaignId: string | null
  session: LiveSessionSnapshot | null
  reconciliationCommandId: string | null
  cause: unknown
}>

export type CampaignWorkspaceReadOutcome =
  | Readonly<{
      status: 'ready'
      value: CampaignWorkspaceProjectionSnapshot
    }>
  | Readonly<{ status: 'stale' }>
  | Readonly<{ status: 'failure'; cause: unknown }>

const emptyCampaigns = Object.freeze({
  revision: 0,
  activeCampaignId: null,
  campaigns: Object.freeze([]),
  trashedCampaigns: Object.freeze([])
}) satisfies CampaignSnapshot

const idleSnapshot = Object.freeze({
  status: 'idle',
  campaigns: emptyCampaigns,
  sessionCampaignId: null,
  session: null,
  reconciliationCommandId: null,
  cause: null
}) satisfies CampaignWorkspaceProjectionSnapshot

type PendingCampaignReconciliation = Readonly<{
  commandId: string
  reconcile: () => Promise<CampaignCommandReceipt>
}>

export class CampaignReconciliationPendingError extends Error {
  public readonly commandId: string

  public constructor(commandId: string, cause?: unknown) {
    super('Campaign command receipt reconciliation is pending.', { cause })
    this.name = 'CampaignReconciliationPendingError'
    this.commandId = commandId
  }
}

/**
 * Provider-lived owner for the Campaign catalog and per-Campaign active
 * Session projections. Composite publication always selects the Session cache
 * by the accepted catalog identity.
 */
export class CampaignWorkspaceProjection {
  readonly #api: SaltMarcherApi
  readonly #catalog: KeyedReadProjectionOwner<CampaignSnapshot>
  readonly #sessions: KeyedReadProjectionOwner<LiveSessionSnapshot>
  readonly #commands: KeyedWriteCommandOwner
  readonly #catalogExecution: ReadProjectionExecution<
    SaltMarcherApi['campaigns']['list'],
    'installation.campaign-catalog'
  >
  readonly #listeners = new Set<() => void>()
  readonly #unsubscribeCatalog: () => void
  readonly #unsubscribeSessionChanges: () => void
  #unsubscribeSession: (() => void) | null = null
  #subscribedCampaignId: string | null = null
  #pendingReconciliation: PendingCampaignReconciliation | null = null
  #snapshot: CampaignWorkspaceProjectionSnapshot = idleSnapshot
  #disposed = false

  public constructor(api: SaltMarcherApi) {
    this.#api = api
    const listCampaigns: SaltMarcherApi['campaigns']['list'] = () =>
      api.campaigns.list()
    this.#catalog = new KeyedReadProjectionOwner(
      new AsyncCommandCoordinator(),
      (snapshot) => snapshot.revision
    )
    this.#sessions = new KeyedReadProjectionOwner(
      new AsyncCommandCoordinator(),
      (session) => session.revision
    )
    this.#commands = new KeyedWriteCommandOwner(new AsyncCommandCoordinator())
    this.#catalogExecution = Object.freeze({
      kind: 'read-projection',
      authority: campaignCatalogAuthority,
      operation: listCampaigns
    })
    this.#unsubscribeCatalog = this.#catalog.subscribe(
      campaignCatalogAuthority,
      this.#synchronize
    )
    this.#unsubscribeSessionChanges = api.session.onChanged(
      this.#handleSessionChange
    )
  }

  public readonly subscribe = (listener: () => void): (() => void) => {
    if (this.#disposed) return () => undefined
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  public readonly snapshot = (): CampaignWorkspaceProjectionSnapshot =>
    this.#snapshot

  public async load(): Promise<CampaignWorkspaceReadOutcome> {
    if (this.#disposed) return Object.freeze({ status: 'stale' })
    const catalog = await settleRead(
      this.#catalog.invalidate(this.#catalogExecution),
      () => this.#catalog.ensure(this.#catalogExecution)
    )
    if (catalog.status === 'failure')
      return Object.freeze({ status: 'failure', cause: catalog.cause })
    if (catalog.status === 'stale') return Object.freeze({ status: 'stale' })
    const campaignId = catalog.value.activeCampaignId
    if (campaignId === null)
      return Object.freeze({ status: 'ready', value: this.#snapshot })
    const session = await this.#refreshSession(campaignId)
    if (
      session.status === 'failure' &&
      capabilityErrorCode(session.cause) === 'stale'
    ) {
      const latest = await settleRead(
        this.#catalog.invalidate(this.#catalogExecution),
        () => this.#catalog.ensure(this.#catalogExecution)
      )
      if (latest.status === 'failure')
        return Object.freeze({ status: 'failure', cause: latest.cause })
      if (latest.status === 'stale') return Object.freeze({ status: 'stale' })
      if (latest.value.activeCampaignId !== campaignId)
        return this.refreshActiveSession()
    }
    return projectWorkspaceOutcome(session, this.#snapshot)
  }

  public async refreshActiveSession(): Promise<CampaignWorkspaceReadOutcome> {
    if (this.#disposed) return Object.freeze({ status: 'stale' })
    const campaignId = this.#catalog.current(
      campaignCatalogAuthority
    )?.activeCampaignId
    if (!campaignId)
      return Object.freeze({ status: 'ready', value: this.#snapshot })
    return projectWorkspaceOutcome(
      await this.#refreshSession(campaignId),
      this.#snapshot
    )
  }

  public publishCampaigns(campaigns: CampaignSnapshot): boolean {
    return this.#catalog.publish(campaignCatalogAuthority, campaigns)
  }

  public async createCampaign(name: string): Promise<CampaignSnapshot> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority: campaignCatalogAuthority,
        commandId,
        command: this.#api.campaigns.create,
        receiptRead: this.#api.campaigns.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#registryRevision(),
          name
        }),
      readReceipt: (operation, id) => operation({ commandId: id }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'created' && receipt.commandId === commandId
          ? receipt
          : null,
      reconcileAbsentReceipt: this.#reconcileCampaignTruth,
      accept: (receipt) => {
        if (
          receipt.snapshot.campaigns.find(
            (campaign) => campaign.id === receipt.campaignId
          )?.name !== name
        )
          throw new CapabilityError('protocol_violation', false)
        return this.publishCampaigns(receipt.snapshot)
      }
    })
    return (await this.#settleCampaignWrite(outcome)).snapshot
  }

  public async activateCampaign(id: string): Promise<CampaignSnapshot> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority: campaignCatalogAuthority,
        commandId,
        command: this.#api.campaigns.activate,
        receiptRead: this.#api.campaigns.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#registryRevision(),
          id
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'activated' &&
        receipt.commandId === commandId &&
        receipt.campaignId === id
          ? receipt
          : null,
      reconcileAbsentReceipt: this.#reconcileCampaignTruth,
      accept: (receipt) => this.publishCampaigns(receipt.snapshot)
    })
    return (await this.#settleCampaignWrite(outcome)).snapshot
  }

  public async renameCampaign(
    id: string,
    name: string
  ): Promise<CampaignSnapshot> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority: campaignCatalogAuthority,
        commandId,
        command: this.#api.campaigns.rename,
        receiptRead: this.#api.campaigns.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#registryRevision(),
          id,
          name
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'renamed' &&
        receipt.commandId === commandId &&
        receipt.campaignId === id
          ? receipt
          : null,
      reconcileAbsentReceipt: this.#reconcileCampaignTruth,
      accept: (receipt) => {
        if (
          receipt.snapshot.campaigns.find((campaign) => campaign.id === id)
            ?.name !== name
        )
          throw new CapabilityError('protocol_violation', false)
        return this.publishCampaigns(receipt.snapshot)
      }
    })
    return (await this.#settleCampaignWrite(outcome)).snapshot
  }

  public async trashCampaign(id: string): Promise<CampaignSnapshot> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority: campaignCatalogAuthority,
        commandId,
        command: this.#api.campaigns.trash,
        receiptRead: this.#api.campaigns.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#registryRevision(),
          id
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'trashed' &&
        receipt.commandId === commandId &&
        receipt.campaignId === id
          ? receipt
          : null,
      reconcileAbsentReceipt: this.#reconcileCampaignTruth,
      accept: (receipt) => this.publishCampaigns(receipt.snapshot)
    })
    return (await this.#settleCampaignWrite(outcome)).snapshot
  }

  public async restoreCampaign(id: string): Promise<CampaignSnapshot> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority: campaignCatalogAuthority,
        commandId,
        command: this.#api.campaigns.restore,
        receiptRead: this.#api.campaigns.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#registryRevision(),
          id
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'restored' &&
        receipt.commandId === commandId &&
        receipt.campaignId === id
          ? receipt
          : null,
      reconcileAbsentReceipt: this.#reconcileCampaignTruth,
      accept: (receipt) => this.publishCampaigns(receipt.snapshot)
    })
    return (await this.#settleCampaignWrite(outcome)).snapshot
  }

  public async deleteCampaignForever(
    id: string,
    confirmationName: string
  ): Promise<CampaignSnapshot> {
    const commandId = crypto.randomUUID()
    const outcome = await this.#commands.runReconciled({
      execution: {
        kind: 'receipt-reconciliation',
        authority: campaignCatalogAuthority,
        commandId,
        command: this.#api.campaigns.deleteForever,
        receiptRead: this.#api.campaigns.commandReceipt
      },
      executeAtTransport: async (operation) =>
        operation({
          commandId,
          expectedRegistryRevision: await this.#registryRevision(),
          id,
          confirmationName
        }),
      readReceipt: (operation, receiptCommandId) =>
        operation({ commandId: receiptCommandId }),
      recoverReceipt: (receipt) =>
        receipt?.kind === 'deleted' &&
        receipt.commandId === commandId &&
        receipt.campaignId === id
          ? receipt
          : null,
      reconcileAbsentReceipt: this.#reconcileCampaignTruth,
      accept: (receipt) => this.publishCampaigns(receipt.snapshot)
    })
    return (await this.#settleCampaignWrite(outcome)).snapshot
  }

  public reconcilePendingCommand(): Promise<CampaignCommandReceipt> {
    const pending = this.#pendingReconciliation
    if (!pending)
      return Promise.reject(new Error('No Campaign command is pending.'))
    return pending.reconcile()
  }

  public publishSession(
    campaignId: string,
    update:
      | LiveSessionSnapshot
      | ((current: LiveSessionSnapshot) => LiveSessionSnapshot)
  ): boolean {
    const authority = campaignSessionAuthority(campaignId)
    const current = this.#sessions.current(authority)
    if (typeof update === 'function' && current === null) return false
    const next = typeof update === 'function' ? update(current!) : update
    return this.#sessions.publish(authority, next)
  }

  public dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#unsubscribeCatalog()
    this.#unsubscribeSessionChanges()
    this.#unsubscribeSession?.()
    this.#unsubscribeSession = null
    this.#catalog.dispose()
    this.#sessions.dispose()
    this.#commands.dispose()
    this.#pendingReconciliation = null
    this.#listeners.clear()
    this.#snapshot = idleSnapshot
  }

  async #refreshSession(
    campaignId: string
  ): Promise<ReadProjectionOutcome<LiveSessionSnapshot>> {
    const authority = campaignSessionAuthority(campaignId)
    const execution: ReadProjectionExecution<
      SaltMarcherApi['session']['read'],
      'campaign.live-session'
    > = Object.freeze({
      kind: 'read-projection',
      authority,
      operation: this.#api.session.read
    })
    return settleRead(
      this.#sessions.invalidate(execution, { campaignId }),
      () => this.#sessions.ensure(execution, { campaignId })
    )
  }

  async #registryRevision(): Promise<number> {
    const current = this.#catalog.current(campaignCatalogAuthority)
    if (current) return current.revision
    const outcome = await settleRead(
      this.#catalog.ensure(this.#catalogExecution),
      () => this.#catalog.ensure(this.#catalogExecution)
    )
    if (outcome.status === 'failure') throw outcome.cause
    if (outcome.status === 'stale')
      throw new Error('Campaign catalog read was superseded.')
    return outcome.value.revision
  }

  readonly #synchronize = (): void => {
    if (this.#disposed) return
    const catalog = this.#catalog.snapshot(campaignCatalogAuthority)
    const campaignId = catalog.value?.activeCampaignId ?? null
    if (campaignId !== this.#subscribedCampaignId) {
      this.#unsubscribeSession?.()
      this.#unsubscribeSession = campaignId
        ? this.#sessions.subscribe(
            campaignSessionAuthority(campaignId),
            this.#synchronize
          )
        : null
      this.#subscribedCampaignId = campaignId
    }
    const session = campaignId
      ? this.#sessions.snapshot(campaignSessionAuthority(campaignId))
      : null
    const next = composeSnapshot(
      catalog,
      campaignId,
      session,
      this.#pendingReconciliation?.commandId ?? null
    )
    if (sameSnapshot(this.#snapshot, next)) return
    this.#snapshot = next
    for (const listener of this.#listeners) listener()
  }

  readonly #handleSessionChange: Parameters<
    SaltMarcherApi['session']['onChanged']
  >[0] = (notice) => {
    if (this.#disposed) return
    const campaignId = this.#catalog.current(
      campaignCatalogAuthority
    )?.activeCampaignId
    if (!campaignId || notice.campaignId !== campaignId) return
    void this.#refreshSession(campaignId)
  }

  async #settleCampaignWrite<Receipt extends CampaignCommandReceipt>(
    outcome: KeyedWriteCommandOutcome<Receipt>
  ): Promise<Receipt> {
    switch (outcome.status) {
      case 'success':
        if (this.#pendingReconciliation?.commandId === outcome.value.commandId)
          this.#clearPendingReconciliation()
        return outcome.value
      case 'failure':
        this.#clearPendingReconciliation()
        if (capabilityErrorCode(outcome.cause) === 'stale') await this.load()
        throw outcome.cause
      case 'stale':
        this.#clearPendingReconciliation()
        throw new Error(`Campaign command was ${outcome.reason}.`)
      case 'blocked':
        throw new CampaignReconciliationPendingError(outcome.pendingCommandId)
      case 'reconciliation-pending': {
        const pending: PendingCampaignReconciliation = Object.freeze({
          commandId: outcome.commandId,
          reconcile: async () =>
            this.#settleCampaignWrite(await outcome.retry())
        })
        this.#pendingReconciliation = pending
        this.#synchronize()
        throw new CampaignReconciliationPendingError(
          outcome.commandId,
          outcome.cause
        )
      }
    }
  }

  #clearPendingReconciliation(): void {
    if (!this.#pendingReconciliation) return
    this.#pendingReconciliation = null
    this.#synchronize()
  }

  readonly #reconcileCampaignTruth = async (): Promise<void> => {
    await this.load()
  }
}

async function settleRead<Value>(
  pending: Promise<ReadProjectionOutcome<Value>>,
  ensure: () => Promise<ReadProjectionOutcome<Value>>
): Promise<ReadProjectionOutcome<Value>> {
  let outcome = await pending
  if (outcome.status === 'stale') outcome = await ensure()
  return outcome
}

function projectWorkspaceOutcome(
  outcome: ReadProjectionOutcome<LiveSessionSnapshot>,
  snapshot: CampaignWorkspaceProjectionSnapshot
): CampaignWorkspaceReadOutcome {
  if (outcome.status === 'failure')
    return Object.freeze({ status: 'failure', cause: outcome.cause })
  if (outcome.status === 'stale') return Object.freeze({ status: 'stale' })
  return Object.freeze({ status: 'ready', value: snapshot })
}

function composeSnapshot(
  catalog: ReadProjectionSnapshot<CampaignSnapshot>,
  campaignId: string | null,
  session: ReadProjectionSnapshot<LiveSessionSnapshot> | null,
  reconciliationCommandId: string | null
): CampaignWorkspaceProjectionSnapshot {
  const campaigns = catalog.value ?? emptyCampaigns
  const sessionValue = session?.value ?? null
  const cause = catalog.status === 'failure' ? catalog.cause : session?.cause
  const complete =
    catalog.value !== null && (!campaignId || sessionValue !== null)
  const failed =
    (catalog.status === 'failure' && catalog.value === null) ||
    (session?.status === 'failure' && session.value === null)
  const status = failed
    ? 'failure'
    : complete
      ? 'ready'
      : catalog.status === 'idle'
        ? 'idle'
        : 'pending'
  return Object.freeze({
    status,
    campaigns,
    sessionCampaignId: campaignId,
    session: sessionValue,
    reconciliationCommandId,
    cause: cause ?? null
  })
}

function sameSnapshot(
  current: CampaignWorkspaceProjectionSnapshot,
  next: CampaignWorkspaceProjectionSnapshot
): boolean {
  return (
    current.status === next.status &&
    current.campaigns === next.campaigns &&
    current.sessionCampaignId === next.sessionCampaignId &&
    current.session === next.session &&
    current.reconciliationCommandId === next.reconciliationCommandId &&
    current.cause === next.cause
  )
}
