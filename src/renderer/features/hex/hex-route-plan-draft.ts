import type {
  HexTravelCommandState,
  HexTravelCommand
} from '../../../shared/contracts/hex-travel-command.js'
import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import type { TravelRoutePlanSnapshot } from '../travel/travel-provider-port.js'
import type { HexTravelCommandController } from './hex-travel-command-controller.js'
import type { HexTravelCommandPort } from './use-hex-travel-command-port.js'

type PlanSnapshot = TravelRoutePlanSnapshot<AxialCoordinate>
type Plan = PlanSnapshot['plan']
type SaveHexRoutePlanInput = Extract<
  HexTravelCommand['command'],
  { kind: 'save-plan' }
>['input']
type Snapshot = Readonly<{
  plan: Plan
  dirty: boolean
  busy: boolean
  error: string | null
}>

/** Owns planning only; all writes and uncertain outcomes belong to the command owner. */
export class HexRoutePlanDraft {
  private state: Snapshot = {
    plan: null,
    dirty: false,
    busy: false,
    error: null
  }
  private basis: PlanSnapshot | null = null
  private requested: SaveHexRoutePlanInput | null = null
  private readonly listeners = new Set<() => void>()
  private attached = true
  private unregister: (() => void) | null = null
  private readonly ownerId = `hex-route-plan-${crypto.randomUUID()}`

  constructor(
    private readonly sceneId: string,
    private readonly port: Pick<HexTravelCommandPort, 'refresh'>,
    private readonly commands: HexTravelCommandController,
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
    for (const listener of this.listeners) listener()
    if (!this.attached && this.isDirty() && !this.unregister)
      this.unregister = this.maintenance.register(this.ownerId, {
        label: message('travel.routeDraft'),
        isDirty: this.isDirty,
        save: this.save,
        discard: this.discard
      })
    if (!this.isDirty()) {
      this.unregister?.()
      this.unregister = null
    }
  }
  attach = (): void => {
    this.attached = true
    this.unregister?.()
    this.unregister = null
  }
  detach = (): void => {
    this.attached = false
    this.publish({})
  }
  isDirty = (): boolean =>
    this.state.dirty || this.requested !== null || this.state.busy

  private adopt(snapshot: PlanSnapshot): void {
    if (snapshot.sceneId !== this.sceneId)
      throw new CapabilityError('stale', false)
    this.basis = structuredClone(snapshot)
    this.requested = null
    this.publish({ plan: this.basis.plan, dirty: false, error: null })
  }
  private acknowledge(): boolean {
    const confirmed = this.commands.confirmed()
    if (!this.requested || confirmed?.input.command.kind !== 'save-plan')
      return false
    const input = confirmed.input.command.input
    if (
      input.sceneId !== this.sceneId ||
      input.expectedPlanRevision !== this.requested.expectedPlanRevision ||
      !samePlan(input.plan, this.requested.plan)
    )
      return false
    this.adopt(confirmed.current.routePlan)
    return true
  }
  observe = (snapshot: PlanSnapshot): void => {
    if (snapshot.sceneId !== this.sceneId) return
    this.acknowledge()
    if (
      this.isDirty() ||
      (this.basis && snapshot.revision < this.basis.revision)
    )
      return
    if (!this.basis || snapshot.revision > this.basis.revision)
      this.adopt(snapshot)
  }
  edit = (plan: Plan): boolean => {
    if (
      !this.attached ||
      !this.basis ||
      this.state.busy ||
      this.commands.held() ||
      this.commands.snapshot().conflict ||
      this.maintenance.isLocked()
    )
      return false
    this.publish({
      plan: structuredClone(plan),
      dirty: !samePlan(plan, this.basis.plan),
      error: null
    })
    return true
  }
  private async current(): Promise<HexTravelCommandState> {
    const current = await this.port.refresh()
    if (
      current.context.session.scene.focusedSceneId !== this.sceneId ||
      current.context.travel.sceneId !== this.sceneId ||
      current.routePlan.sceneId !== this.sceneId
    )
      throw new CapabilityError('stale', false)
    return current
  }
  save = async (): Promise<boolean> => {
    if (this.state.busy) return false
    this.publish({ busy: true, error: null })
    try {
      if (!(await this.commands.save())) return false
      this.acknowledge()
      if (!this.state.dirty) return true
      const current = await this.current()
      if (!this.basis || current.routePlan.revision !== this.basis.revision)
        throw new Error(message('travel.planConflict'))
      const plan = this.state.plan
      this.requested = {
        sceneId: this.sceneId,
        expectedPlanRevision: this.basis.revision,
        expectedSceneRevision: current.context.session.scene.revision,
        plan: plan ? { ...plan, waypoints: [...plan.waypoints] } : null
      }
      const saved = await this.commands.savePlan(this.requested)
      if (!saved) return false
      return (
        this.acknowledge() || (!this.state.dirty && this.requested === null)
      )
    } catch (cause) {
      this.publish({ error: capabilityErrorText(cause) })
      throw cause
    } finally {
      this.publish({ busy: false })
    }
  }
  discard = async (): Promise<boolean> => {
    if (this.state.busy) return false
    this.publish({ busy: true, error: null })
    try {
      if (!(await this.commands.discard())) return false
      this.adopt((await this.current()).routePlan)
      return true
    } catch (cause) {
      this.publish({ error: capabilityErrorText(cause) })
      throw cause
    } finally {
      this.publish({ busy: false })
    }
  }
}

function samePlan(left: Plan, right: Plan): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
