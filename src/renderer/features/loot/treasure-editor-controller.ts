import type {
  Treasure,
  TreasureAnchor,
  TreasureEditorCommand
} from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  treasureDraftInvalid,
  type EditableTreasureDraft
} from './treasure-draft.js'
import {
  reduceTreasureDraft,
  type TreasureDraftCommand
} from './treasure-draft-reducer.js'
import type { TreasureEditorPort } from './use-loot-ports.js'

type Snapshot = Readonly<{
  draft: EditableTreasureDraft
  anchor: TreasureAnchor
  busy: boolean
  uncertain: boolean
  error: string | null
  closed: boolean
}>
export class TreasureEditorController {
  private state: Snapshot
  private readonly baseline: string
  private readonly listeners = new Set<() => void>()
  private pending: Promise<boolean> | null = null
  private attempt: TreasureEditorCommand | null = null
  private conflict = false
  constructor(
    private readonly port: TreasureEditorPort,
    private readonly treasure: Treasure | null,
    draft: EditableTreasureDraft,
    anchor: TreasureAnchor,
    private callbacks: {
      saved(): void | Promise<void>
      close(): void | Promise<void>
    }
  ) {
    this.state = {
      draft,
      anchor,
      busy: false,
      uncertain: false,
      error: null,
      closed: false
    }
    this.baseline = JSON.stringify({ draft, anchor })
  }
  updateCallbacks(callbacks: {
    saved(): void | Promise<void>
    close(): void | Promise<void>
  }): void {
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
  blocked = (): boolean =>
    maintenanceDraftCoordinator.isLocked() ||
    Boolean(this.pending || this.attempt || this.state.closed)
  dispatch = (command: TreasureDraftCommand): void => {
    if (!this.blocked())
      this.publish({
        draft: reduceTreasureDraft(this.state.draft, command, 'manual')
      })
  }
  setAnchor = (anchor: TreasureAnchor): void => {
    if (!this.blocked()) this.publish({ anchor })
  }
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
  private async finish(saved: boolean): Promise<boolean> {
    if (saved) await this.callbacks.saved()
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
    if (this.state.closed) return Promise.resolve(true)
    if (this.conflict || treasureDraftInvalid(this.state.draft)) {
      this.publish({
        error: message(
          this.conflict ? 'loot.editorConflict' : 'loot.editorInvalid'
        )
      })
      return Promise.resolve(false)
    }
    const { draft, anchor } = this.state
    const value = {
      commandId: crypto.randomUUID(),
      label: draft.label,
      anchor,
      containers: draft.containers.map((container) => ({
        id: container.persistedId ?? container.draftId,
        catalogContainerId: container.catalogContainerId,
        name: container.name,
        capacity: container.capacity
      })),
      items: draft.items.map((item) => ({
        ...(item.persistedId ? { id: item.persistedId } : {}),
        itemReference: item.itemReference!,
        quantity: item.quantity,
        containerId: item.containerId
      }))
    }
    const input: TreasureEditorCommand = this.treasure
      ? {
          kind: 'update',
          input: {
            ...value,
            treasureId: this.treasure.id,
            expectedRevision: this.treasure.revision
          }
        }
      : { kind: 'create', input: value }
    return this.run(async () => {
      this.attempt = input
      try {
        if (input.kind === 'create') await this.port.create(input.input)
        else await this.port.update(input.input)
        return await this.finish(true)
      } catch (cause) {
        this.publish({ uncertain: true })
        throw cause
      }
    })
  }
  private async reconcile(): Promise<boolean> {
    const input = this.attempt
    if (!input) return true
    const result = await this.port.editorStatus(input)
    if (result.receipt) return this.finish(true)
    this.conflict =
      input.kind === 'update' &&
      result.treasure?.revision !== input.input.expectedRevision
    this.attempt = null
    this.publish({
      uncertain: false,
      error: message(
        this.conflict ? 'loot.editorConflict' : 'loot.editorNotSaved'
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
    if (
      JSON.stringify({ draft: this.state.draft, anchor: this.state.anchor }) ===
      this.baseline
    )
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
