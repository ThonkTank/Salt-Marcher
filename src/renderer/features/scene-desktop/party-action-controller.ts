import { message } from '../../i18n/session-runtime.de.js'
import type {
  PartyActionPort,
  PartyActionCommand
} from './use-party-action-port.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
type PartyActionReceipt = Awaited<
  ReturnType<SaltMarcherApi['party']['undoRedo']>
>
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'

type Snapshot = Readonly<{
  busy: boolean
  uncertain: boolean
  conflict: boolean
  error: string | null
}>
type Completion = (
  receipt: PartyActionReceipt,
  current: LiveSessionSnapshot
) => void

/** An unresolved write outlives its view; recovery never submits another command. */
export class PartyActionController {
  private state: Snapshot = {
    busy: false,
    uncertain: false,
    conflict: false,
    error: null
  }
  private readonly listeners = new Set<() => void>()
  private pending: Promise<boolean> | null = null
  private attempt: PartyActionCommand | null = null
  private unsaved: PartyActionCommand | null = null
  private completion: Completion | null = null
  private attached = true
  private unregister: (() => void) | null = null
  private readonly ownerId = `party-action-${crypto.randomUUID()}`

  constructor(
    private readonly port: PartyActionPort,
    private readonly maintenance: MaintenanceDraftCoordinator = maintenanceDraftCoordinator
  ) {}

  snapshot = (): Snapshot => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<Snapshot>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  unresolved = (): boolean => Boolean(this.pending || this.attempt)
  private held = (): boolean => this.unresolved() || this.unsaved !== null
  attach(completion: Completion): void {
    this.attached = true
    this.completion = completion
    this.unregister?.()
    this.unregister = null
  }
  detach = (): void => {
    this.attached = false
    this.completion = null
    this.retainDetachedAttempt()
  }
  private retainDetachedAttempt(): void {
    if (this.attached || !this.held() || this.unregister) return
    this.unregister = this.maintenance.register(this.ownerId, {
      label: 'Party-Verlauf',
      isDirty: this.held,
      save: this.saveDetached,
      discard: this.discardDetached
    })
  }
  private releaseSettledAttempt(): void {
    if (this.held()) return
    this.unregister?.()
    this.unregister = null
  }
  private run(operation: () => Promise<boolean>): Promise<boolean> {
    if (this.pending) return this.pending
    const request = Promise.resolve()
      .then(operation)
      .catch((cause: unknown) => {
        this.publish({
          uncertain: Boolean(this.attempt),
          error: capabilityErrorText(cause)
        })
        return false
      })
      .finally(() => {
        this.pending = null
        this.publish({ busy: false })
        this.releaseSettledAttempt()
      })
    this.pending = request
    this.publish({ busy: true, error: null })
    this.retainDetachedAttempt()
    return request
  }
  private complete(
    receipt: PartyActionReceipt,
    current: LiveSessionSnapshot
  ): boolean {
    this.completion?.(receipt, current)
    this.attempt = null
    this.unsaved = null
    this.publish({ uncertain: false, conflict: false })
    return true
  }
  execute = (input: PartyActionCommand): Promise<boolean> => {
    if (this.unresolved() || this.state.conflict || !this.attached)
      return Promise.resolve(false)
    return this.start(input)
  }
  private start(input: PartyActionCommand): Promise<boolean> {
    const original = structuredClone(input)
    this.attempt = original
    this.unsaved = null
    return this.run(async () => {
      const receipt = await this.port.execute(original)
      const current = await this.port.refresh()
      return this.complete(receipt, current)
    })
  }
  /** Used by the mounted owner as well as the detached maintenance registration. */
  settle = async (): Promise<boolean> => {
    await this.pending
    if (!this.attempt) return true
    return this.run(async () => {
      const input = this.attempt!
      const result = await this.port.status(input)
      const current = await this.port.refresh()
      if (result.committed) return this.complete(result.result, current)
      const conflict =
        'direction' in input
          ? result.result.history[input.direction]?.id !== input.stepId
          : result.result.settings.revision !== input.expectedRevision
      this.attempt = null
      this.unsaved = input
      this.publish({
        uncertain: false,
        conflict,
        error: message(
          conflict ? 'character.commandConflict' : 'character.commandAbsent'
        )
      })
      return true
    })
  }
  private saveDetached = async (): Promise<boolean> => {
    if (!(await this.settle())) return false
    if (!this.unsaved) return true
    if (this.state.conflict)
      throw new Error(message('character.commandConflict'))
    return this.start({ ...this.unsaved, commandId: crypto.randomUUID() })
  }
  private discardDetached = async (): Promise<boolean> => {
    if (!(await this.settle())) return false
    return this.reset()
  }
  /** Only the editor's explicit discard/new-draft transition may reset a conflict. */
  reset = (): boolean => {
    if (this.unresolved()) return false
    this.unsaved = null
    this.publish({ conflict: false, error: null, uncertain: false })
    this.releaseSettledAttempt()
    return true
  }
}
