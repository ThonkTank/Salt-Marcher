import type {
  CharacterLootEntry,
  CharacterLootLedger,
  CorrectCharacterLootInput
} from '../../../shared/contracts/loot.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/session-runtime.de.js'
import type { CharacterLootPort } from './use-loot-ports.js'

type Correction = Readonly<{
  entry: CharacterLootEntry
  commandId: string
  revision: number
  quantity: number
  status: CharacterLootEntry['status']
  reason: string
}>
type Snapshot = Readonly<{
  ledger: CharacterLootLedger | null
  correction: Correction | null
  busy: boolean
  uncertain: boolean
  error: string | null
}>

/** A dialog retains its original campaign-bound port throughout recovery. */
export class CharacterLedgerController {
  private state: Snapshot = {
    ledger: null,
    correction: null,
    busy: false,
    uncertain: false,
    error: null
  }
  private pending: Promise<boolean> | null = null
  private attempt: CorrectCharacterLootInput | null = null
  private readonly listeners = new Set<() => void>()
  constructor(
    private readonly port: CharacterLootPort,
    private readonly characterId: string
  ) {}
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
  dirty = (): boolean =>
    Boolean(this.state.correction || this.pending || this.attempt)
  blocked = (): boolean =>
    maintenanceDraftCoordinator.isLocked() ||
    Boolean(this.pending || this.attempt)
  private run(operation: () => Promise<boolean>): Promise<boolean> {
    if (this.pending) return this.pending
    this.publish({ busy: true })
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
  load = (): Promise<boolean> => {
    if (this.blocked() || this.state.correction) return Promise.resolve(false)
    return this.run(async () => {
      this.acceptLedger(
        await this.port.ledger({ characterId: this.characterId })
      )
      return true
    })
  }
  private acceptLedger(ledger: CharacterLootLedger): void {
    if (ledger.characterId !== this.characterId)
      throw new Error(message('loot.correctionReadMismatch'))
    this.publish({ ledger, error: null })
  }
  open = (entry: CharacterLootEntry): void => {
    if (this.blocked() || this.state.correction || !this.state.ledger) return
    this.publish({
      correction: {
        entry,
        commandId: crypto.randomUUID(),
        revision: this.state.ledger.revision,
        quantity: entry.quantity,
        status: entry.status,
        reason: ''
      },
      error: null
    })
  }
  patch = (
    patch: Partial<Pick<Correction, 'quantity' | 'status' | 'reason'>>
  ): void => {
    if (this.blocked() || !this.state.correction) return
    this.publish({
      correction: {
        ...this.state.correction,
        ...patch,
        commandId: crypto.randomUUID()
      }
    })
  }
  cancel = (): void => {
    if (!this.blocked()) this.publish({ correction: null, error: null })
  }
  save = (): Promise<boolean> =>
    this.blocked() ? Promise.resolve(false) : this.saveDraft()
  private saveDraft(): Promise<boolean> {
    const correction = this.state.correction
    if (!correction) return Promise.resolve(true)
    if (
      !correction.reason.trim() ||
      correction.reason.trim().length > 500 ||
      !Number.isSafeInteger(correction.quantity) ||
      correction.quantity < 1
    ) {
      this.publish({ error: message('loot.correctionInvalid') })
      return Promise.resolve(false)
    }
    if (this.state.ledger?.revision !== correction.revision) {
      this.publish({ error: message('loot.correctionConflict') })
      return Promise.resolve(false)
    }
    const input: CorrectCharacterLootInput = {
      commandId: correction.commandId,
      characterId: this.characterId,
      entryId: correction.entry.id,
      expectedRevision: correction.revision,
      quantity: correction.quantity,
      status: correction.status,
      reason: correction.reason.trim()
    }
    return this.run(async () => {
      this.attempt = input
      this.publish({ error: null })
      try {
        this.acceptLedger(await this.port.correctLedger(input))
        this.attempt = null
        this.publish({ correction: null })
        return true
      } catch (cause) {
        this.publish({ uncertain: true })
        throw cause
      }
    })
  }
  private async reconcile(): Promise<boolean> {
    const input = this.attempt
    if (!input) return true
    const result = await this.port.correctionStatus(input)
    if (
      result.ledger.characterId !== this.characterId ||
      (result.receipt &&
        (result.receipt.characterId !== this.characterId ||
          result.ledger.revision < result.receipt.revision))
    )
      throw new Error(message('loot.correctionReadMismatch'))
    this.acceptLedger(result.ledger)
    this.attempt = null
    this.publish({
      uncertain: false,
      ...(result.receipt
        ? { correction: null }
        : { error: message('loot.correctionNotSaved') })
    })
    return true
  }
  retry = (): Promise<boolean> => {
    if (maintenanceDraftCoordinator.isLocked() || this.pending)
      return Promise.resolve(false)
    return this.run(() => this.reconcile())
  }
  maintenanceSave = async (): Promise<boolean> => {
    await this.pending
    if (this.attempt && !(await this.run(() => this.reconcile()))) return false
    return this.saveDraft()
  }
  maintenanceDiscard = async (): Promise<boolean> => {
    await this.pending
    return this.run(async () => {
      if (this.attempt) await this.reconcile()
      else
        this.acceptLedger(
          await this.port.ledger({ characterId: this.characterId })
        )
      this.publish({ correction: null, error: null })
      return true
    })
  }
}
