import { message } from '../../i18n/session-runtime.de.js'
import type { CombatCommand } from '../../../shared/contracts/combat-command.js'
import type {
  LiveSessionSnapshot,
  CombatCommandResult
} from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import type { CombatCommandPort } from './use-combat-command-port.js'

type Snapshot = Readonly<{
  busy: boolean
  uncertain: boolean
  conflict: boolean
  error: string | null
}>
type Completion = (
  receipt: CombatCommandResult,
  current: LiveSessionSnapshot
) => void

/** An unresolved write outlives its view; recovery never submits another command. */
export class CombatCommandController {
  private state: Snapshot = {
    busy: false,
    uncertain: false,
    conflict: false,
    error: null
  }
  private readonly listeners = new Set<() => void>()
  private pending: Promise<boolean> | null = null
  private attempt: CombatCommand | null = null
  private unsaved: CombatCommand | null = null
  private completion: Completion | null = null
  private attached = true
  private unregister: (() => void) | null = null
  private readonly ownerId = `combat-command-${crypto.randomUUID()}`

  constructor(
    private readonly port: Pick<
      CombatCommandPort,
      'execute' | 'status' | 'refresh'
    >,
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
      label: 'Kampfaktionen',
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
        this.publish({ busy: false })
        this.releaseSettledAttempt()
      })
    this.pending = request
    this.publish({ busy: true, error: null })
    this.retainDetachedAttempt()
    return request
  }
  private complete(
    receipt: CombatCommandResult,
    current: LiveSessionSnapshot
  ): boolean {
    this.completion?.(receipt, current)
    this.attempt = null
    this.unsaved = null
    this.publish({ uncertain: false, conflict: false })
    return true
  }
  execute = (input: CombatCommand): Promise<boolean> => {
    if (this.held() || this.state.conflict || !this.attached)
      return Promise.resolve(false)
    return this.start(input)
  }
  private start(input: CombatCommand): Promise<boolean> {
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
        !this.matchesRevisions(input, result.snapshot) ||
        !this.matchesRevisions(input, current)
      this.attempt = null
      this.unsaved = input
      this.publish({
        uncertain: false,
        conflict,
        error: message(
          conflict ? 'combat.commandConflict' : 'character.commandAbsent'
        )
      })
      return true
    })
  }
  private matchesRevisions(
    input: CombatCommand,
    snapshot: LiveSessionSnapshot
  ): boolean {
    if (snapshot.scene.focusedSceneId !== input.sceneId) return false
    const command = input.command
    if (command.kind === 'prepare')
      return (
        snapshot.combat === null &&
        snapshot.scene.revision === command.input.expectedSceneRevision
      )
    if (command.kind === 'joinGroup') {
      const group = snapshot.scene.scenes
        .find((scene) => scene.id === input.sceneId)
        ?.groups.find((group) => group.id === command.input.groupId)
      return (
        snapshot.combat?.revision === command.input.expectedCombatRevision &&
        group?.revision === command.input.expectedGroupRevision
      )
    }
    return snapshot.combat?.revision === command.input.expectedRevision
  }

  save = async (): Promise<boolean> => {
    if (!(await this.settle())) return false
    if (!this.unsaved) return true
    if (this.state.conflict) throw new Error(message('combat.commandConflict'))
    return this.start({ ...this.unsaved, commandId: crypto.randomUUID() })
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
