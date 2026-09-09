import { message } from '../../i18n/session-runtime.de.js'
const conflictText = message('travel.commandConflict')
import type { HexTravelCommand } from '../../../shared/contracts/hex-travel-command.js'
import type { HexTravelCommandState } from '../../../shared/contracts/hex-travel-command.js'
import type { HexTravelCommandReceipt } from '../../../shared/contracts/hex-travel-command.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import type { HexTravelCommandPort } from './use-hex-travel-command-port.js'

type Snapshot = Readonly<{
  busy: boolean
  uncertain: boolean
  conflict: boolean
  error: string | null
}>
export type HexTravelCommandConfirmation = Readonly<{
  input: HexTravelCommand
  receipt: HexTravelCommandReceipt
  current: HexTravelCommandState
}>
type Completion = (
  receipt: HexTravelCommandReceipt,
  current: HexTravelCommandState
) => void

/** An unresolved write outlives its view; recovery never submits another command. */
export class HexTravelCommandController {
  private state: Snapshot = {
    busy: false,
    uncertain: false,
    conflict: false,
    error: null
  }
  private readonly listeners = new Set<() => void>()
  private pending: Promise<boolean> | null = null
  private resolution: Promise<boolean> | null = null
  private attempt: HexTravelCommand | null = null
  private unsaved: HexTravelCommand | null = null
  private completion: Completion | null = null
  private confirmation: HexTravelCommandConfirmation | null = null
  private attached = true
  private unregister: (() => void) | null = null
  private readonly ownerId = `hex-travel-command-${crypto.randomUUID()}`

  constructor(
    private readonly port: Pick<
      HexTravelCommandPort,
      'execute' | 'status' | 'refresh'
    >,
    private readonly maintenance: MaintenanceDraftCoordinator = maintenanceDraftCoordinator
  ) {}

  confirmed = (): HexTravelCommandConfirmation | null => this.confirmation
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
  unresolved = (): boolean =>
    Boolean(this.pending || this.attempt || this.resolution)
  held = (): boolean => this.unresolved() || this.unsaved !== null
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
      label: message('travel.commands'),
      isDirty: this.held,
      save: this.save,
      discard: this.discard
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
        this.publish({ busy: this.resolution !== null })
        this.releaseSettledAttempt()
      })
    this.pending = request
    this.publish({ busy: true, error: null })
    this.retainDetachedAttempt()
    return request
  }
  private complete(
    receipt: HexTravelCommandReceipt,
    current: HexTravelCommandState
  ): boolean {
    if (this.attempt)
      this.confirmation = { input: this.attempt, receipt, current }
    this.completion?.(receipt, current)
    this.attempt = null
    this.unsaved = null
    this.publish({ uncertain: false, conflict: false })
    return true
  }
  execute = (input: HexTravelCommand): Promise<boolean> => {
    if (this.held() || this.state.conflict || !this.attached)
      return Promise.resolve(false)
    return this.start(input)
  }
  /** Only the retained route editor may save a plan after its view has detached. */
  savePlan = (
    input: Extract<HexTravelCommand['command'], { kind: 'save-plan' }>['input']
  ): Promise<boolean> => {
    if (this.held() || this.state.conflict) return Promise.resolve(false)
    return this.start({
      commandId: crypto.randomUUID(),
      command: { kind: 'save-plan', input }
    })
  }
  private start(input: HexTravelCommand): Promise<boolean> {
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
      if (result.receipt) return this.complete(result.receipt, current)
      const conflict =
        !this.matchesRevisions(input, result) ||
        !this.matchesRevisions(input, current)
      this.attempt = null
      this.unsaved = input
      this.publish({
        uncertain: false,
        conflict,
        error: conflict ? conflictText : message('travel.commandAbsent')
      })
      return true
    })
  }
  private matchesRevisions(
    input: HexTravelCommand,
    snapshot: HexTravelCommandState
  ): boolean {
    const command = input.command
    if (
      snapshot.context.session.scene.focusedSceneId !== command.input.sceneId ||
      snapshot.context.session.scene.revision !==
        command.input.expectedSceneRevision ||
      snapshot.context.travel.sceneId !== command.input.sceneId ||
      snapshot.routePlan.sceneId !== command.input.sceneId
    )
      return false
    if (command.kind === 'save-plan')
      return snapshot.routePlan.revision === command.input.expectedPlanRevision
    if (command.kind === 'position') return true
    return snapshot.context.travel.revision === command.input.expectedRevision
  }

  save = (): Promise<boolean> => {
    if (this.resolution) return this.resolution
    const resolution = this.saveResolved()
      .catch((cause: unknown) => {
        this.publish({ error: capabilityErrorText(cause) })
        throw cause
      })
      .finally(() => {
        this.resolution = null
        this.publish({ busy: this.pending !== null })
        this.releaseSettledAttempt()
      })
    this.resolution = resolution
    this.publish({ busy: true })
    return resolution
  }
  private async saveResolved(): Promise<boolean> {
    if (!(await this.settle())) return false
    if (!this.unsaved) return true
    if (this.state.conflict) throw new Error(conflictText)
    const original = this.unsaved
    const current = await this.port.refresh()
    if (!this.matchesRevisions(original, current)) {
      this.publish({ conflict: true, error: conflictText })
      throw new Error(conflictText)
    }
    return this.start({ ...original, commandId: crypto.randomUUID() })
  }
  discard = async (): Promise<boolean> => {
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
