import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SaveSceneGroupInput } from '../../../shared/contracts/scene.js'
import {
  CapabilityError,
  capabilityErrorCode
} from '../../../shared/errors/capability-error.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import {
  draftConcern,
  maintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'

type Change = { creatureId: string; delta: number | null }
type Queue = {
  ownerId: string
  changes: Change[]
  request: SaveSceneGroupInput | null
  pending: Promise<void> | null
  uncertain: boolean
  unregister: () => void
}
/** Each group's requested changes survive view changes until receipts settle them. */
export class InlineGroupCommands {
  private readonly queues = new Map<string, Queue>()
  private readonly listeners = new Set<() => void>()
  private state: Readonly<{ error: string; held: readonly string[] }> = {
    error: '',
    held: []
  }
  constructor(
    private readonly api: SaltMarcherApi,
    private readonly campaignId: string,
    private readonly sceneId: string,
    private readonly applied: (snapshot: LiveSessionSnapshot) => void
  ) {}
  snapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(error = '') {
    this.state = { error, held: [...this.queues.keys()] }
    this.listeners.forEach((listener) => listener())
  }
  enqueue(groupId: string, creatureId: string, delta: number | null) {
    if (maintenanceDraftCoordinator.isLocked()) return
    let queue = this.queues.get(groupId)
    if (!queue) {
      const id = `inline-group-${crypto.randomUUID()}`
      queue = {
        ownerId: id,
        changes: [],
        request: null,
        pending: null,
        uncertain: false,
        unregister: () => undefined
      }
      this.queues.set(groupId, queue)
      queue.unregister = maintenanceDraftCoordinator.register(id, {
        label: 'Gruppenmengen',
        concerns: [
          draftConcern.scene(this.sceneId),
          draftConcern.groups(this.sceneId),
          draftConcern.group(groupId)
        ],
        isDirty: () => this.queues.has(groupId),
        settleBackgroundWrites: async () => {
          await this.settle(groupId)
        },
        save: () => this.retry(groupId),
        discard: () => this.discard(groupId)
      })
    }
    if (maintenanceDraftCoordinator.isDraftLocked(queue.ownerId)) {
      if (!queue.changes.length) {
        queue.unregister()
        this.queues.delete(groupId)
      }
      return
    }
    queue.changes.push({ creatureId, delta })
    if (!queue.request && !queue.pending) void this.drain(groupId)
    this.publish()
  }
  private async prepare(
    groupId: string,
    change: Change
  ): Promise<SaveSceneGroupInput> {
    const current = await this.api.session.read({ campaignId: this.campaignId })
    const scene = current.scene.scenes.find((s) => s.id === this.sceneId)
    const group = scene?.groups.find((g) => g.id === groupId)
    if (!group || group.archived) throw new CapabilityError('stale', false)
    return {
      commandId: crypto.randomUUID(),
      sceneId: this.sceneId,
      groupId,
      expectedRevision: current.scene.revision,
      expectedGroupRevision: group.revision,
      name: group.name,
      note: group.note,
      disposition: group.disposition,
      entries: group.entries.flatMap((entry) =>
        entry.creatureId === change.creatureId && change.delta === null
          ? []
          : [
              {
                creatureId: entry.creatureId,
                quantity:
                  entry.creatureId === change.creatureId
                    ? Math.min(
                        999,
                        Math.max(0, entry.aliveQuantity + (change.delta ?? 0))
                      )
                    : entry.aliveQuantity,
                deadQuantity: entry.deadQuantity
              }
            ]
      )
    }
  }
  private drain(groupId: string): Promise<void> {
    const queue = this.queues.get(groupId)
    if (!queue) return Promise.resolve()
    if (queue.pending) return queue.pending
    queue.pending = Promise.resolve()
      .then(async () => {
        while (queue.changes.length) {
          queue.request ??= await this.prepare(groupId, queue.changes[0]!)
          await this.api.scene.saveGroup(queue.request)
          queue.request = null
          queue.uncertain = false
          queue.changes.shift()
          this.applied(
            await this.api.session.read({ campaignId: this.campaignId })
          )
        }
        queue.unregister()
        this.queues.delete(groupId)
        this.publish()
      })
      .catch((cause: unknown) => {
        queue.uncertain = capabilityErrorCode(cause) === 'outcome_unknown'
        if (capabilityErrorCode(cause) === 'stale') queue.request = null
        this.publish(capabilityErrorText(cause))
      })
      .finally(() => {
        queue.pending = null
      })
    return queue.pending
  }
  private async settle(groupId: string): Promise<boolean> {
    const queue = this.queues.get(groupId)
    if (!queue) return true
    await queue.pending
    if (!queue.request) return !this.queues.has(groupId)
    try {
      const receipt = await this.api.scene.groupSaveReceipt({
        ...queue.request,
        campaignId: this.campaignId
      })
      queue.uncertain = false
      if (receipt) {
        queue.changes.shift()
        queue.request = null
        this.applied(
          await this.api.session.read({ campaignId: this.campaignId })
        )
        await this.drain(groupId)
      }
      return !this.queues.has(groupId)
    } catch (cause) {
      this.publish(capabilityErrorText(cause))
      return false
    }
  }
  retry = async (groupId: string): Promise<boolean> => {
    if (await this.settle(groupId)) return true
    const queue = this.queues.get(groupId)
    if (!queue || queue.uncertain) return false
    await this.drain(groupId)
    return !this.queues.has(groupId)
  }
  discard = async (groupId: string): Promise<boolean> => {
    if (await this.settle(groupId)) return true
    const queue = this.queues.get(groupId)
    if (!queue || queue.uncertain) return false
    queue.unregister()
    this.queues.delete(groupId)
    this.publish()
    return true
  }
}
