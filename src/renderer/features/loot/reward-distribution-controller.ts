import type {
  CompleteLootDistributionInput,
  Treasure
} from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import type { RewardDistributionPort } from './use-loot-ports.js'

type ShareDraft = Readonly<{ characterId: string; quantity: number }>
type Shares = Readonly<Record<string, readonly ShareDraft[]>>
type Snapshot = Readonly<{
  shares: Shares
  busy: boolean
  uncertain: boolean
  closed: boolean
  error: string | null
}>
type Callbacks = {
  completed(): void | Promise<void>
  close(): void | Promise<void>
}

export class RewardDistributionController {
  readonly availableItems: Treasure['items']
  private state: Snapshot
  private readonly baseline: string
  private readonly listeners = new Set<() => void>()
  private pending: Promise<boolean> | null = null
  private attempt: CompleteLootDistributionInput | null = null
  private conflict = false
  constructor(
    private readonly port: RewardDistributionPort,
    private readonly treasure: Treasure,
    private readonly partyRevision: number,
    private callbacks: Callbacks
  ) {
    this.availableItems = treasure.items.filter(
      (item) => item.quantity > item.allocatedQuantity
    )
    const shares = Object.fromEntries(
      this.availableItems.map((item) => [
        item.id,
        [{ characterId: '', quantity: item.quantity - item.allocatedQuantity }]
      ])
    )
    this.state = {
      shares,
      busy: false,
      uncertain: false,
      closed: false,
      error: null
    }
    this.baseline = JSON.stringify(shares)
  }
  updateCallbacks(callbacks: Callbacks): void {
    this.callbacks = callbacks
  }
  snapshot = (): Snapshot => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<Snapshot>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  dirty = (): boolean => !this.state.closed
  private blocked(): boolean {
    return (
      maintenanceDraftCoordinator.isLocked() ||
      Boolean(this.pending || this.attempt || this.state.closed)
    )
  }
  private edit(
    itemId: string,
    change: (rows: readonly ShareDraft[]) => readonly ShareDraft[]
  ): void {
    if (
      !this.blocked() &&
      this.availableItems.some((item) => item.id === itemId)
    )
      this.publish({
        shares: {
          ...this.state.shares,
          [itemId]: change(this.state.shares[itemId] ?? [])
        }
      })
  }
  change = (itemId: string, index: number, patch: Partial<ShareDraft>): void =>
    this.edit(itemId, (rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    )
  add = (itemId: string): void =>
    this.edit(itemId, (rows) => [...rows, { characterId: '', quantity: 1 }])
  remove = (itemId: string, index: number): void =>
    this.edit(itemId, (rows) =>
      rows.filter((_, rowIndex) => rowIndex !== index)
    )
  validation = (): string | null =>
    validateDistribution(this.availableItems, this.state.shares)
  private run(operation: () => Promise<boolean>): Promise<boolean> {
    if (this.pending) return this.pending
    this.publish({ busy: true, error: null })
    const request = Promise.resolve()
      .then(operation)
      .catch((cause: unknown) => {
        this.publish({ error: capabilityErrorText(cause) })
        return false
      })
      .finally(() => {
        this.pending = null
        this.publish({ busy: false })
      })
    this.pending = request
    return request
  }
  private async finish(completed: boolean): Promise<boolean> {
    if (completed) await this.callbacks.completed()
    else await this.callbacks.close()
    this.attempt = null
    this.publish({ closed: true, uncertain: false })
    return true
  }
  close = (): Promise<boolean> =>
    this.blocked() ? Promise.resolve(false) : this.run(() => this.finish(false))
  save = (): Promise<boolean> =>
    this.blocked() ? Promise.resolve(false) : this.saveDraft()
  private saveDraft(): Promise<boolean> {
    const validation = this.validation()
    if (this.conflict || validation) {
      this.publish({
        error: this.conflict ? message('loot.distributionConflict') : validation
      })
      return Promise.resolve(false)
    }
    const input: CompleteLootDistributionInput = {
      commandId: crypto.randomUUID(),
      treasureId: this.treasure.id,
      expectedTreasureRevision: this.treasure.revision,
      expectedPartyRevision: this.partyRevision,
      items: this.availableItems.flatMap((item) => {
        const shares = (this.state.shares[item.id] ?? []).filter(
          (row) => row.characterId
        )
        return shares.length
          ? [{ itemId: item.id, shares: shares.map((row) => ({ ...row })) }]
          : []
      })
    }
    return this.run(async () => {
      this.attempt = input
      try {
        await this.port.distribute(input)
        return await this.finish(true)
      } catch (cause) {
        this.publish({ uncertain: true })
        throw cause
      }
    })
  }
  private async reconcile(): Promise<boolean> {
    if (!this.attempt) return true
    const input = this.attempt
    const result = await this.port.distributionStatus(input)
    if (result.receipt) return this.finish(true)
    this.conflict =
      result.treasure.revision !== input.expectedTreasureRevision ||
      result.partyRevision !== input.expectedPartyRevision
    this.attempt = null
    this.publish({
      uncertain: false,
      error: message(
        this.conflict
          ? 'loot.distributionConflict'
          : 'loot.distributionNotSaved'
      )
    })
    return true
  }
  retry = (): Promise<boolean> =>
    maintenanceDraftCoordinator.isLocked() || this.pending
      ? Promise.resolve(false)
      : this.run(() => this.reconcile())
  maintenanceSave = async (): Promise<boolean> => {
    await this.pending
    if (this.state.closed) return true
    if (this.attempt && !(await this.run(() => this.reconcile()))) return false
    if (this.state.closed) return true
    if (JSON.stringify(this.state.shares) === this.baseline)
      return this.run(() => this.finish(false))
    return this.saveDraft()
  }
  maintenanceDiscard = async (): Promise<boolean> => {
    await this.pending
    if (this.state.closed) return true
    return this.run(async () => {
      if (this.attempt) await this.reconcile()
      return this.state.closed || this.finish(false)
    })
  }
}

function validateDistribution(
  items: Treasure['items'],
  shares: Shares
): string | null {
  let assigned = 0
  for (const item of items) {
    const selected = (shares[item.id] ?? []).filter((row) => row.characterId)
    const recipients = new Set(selected.map((row) => row.characterId))
    const quantity = selected.reduce((sum, row) => sum + row.quantity, 0)
    if (recipients.size !== selected.length)
      return message('loot.recipientUnique')
    if (
      selected.some(
        (row) => !Number.isSafeInteger(row.quantity) || row.quantity < 1
      )
    )
      return message('loot.quantityPositive')
    if (quantity > item.quantity - item.allocatedQuantity)
      return formatMessage('loot.overAllocated', { name: item.definition.name })
    if (
      !item.definition.stackable &&
      quantity !== 0 &&
      quantity !== item.quantity - item.allocatedQuantity
    )
      return formatMessage('loot.notStackable', { name: item.definition.name })
    assigned += quantity
  }
  return assigned > 0 ? null : message('loot.assignmentRequired')
}
