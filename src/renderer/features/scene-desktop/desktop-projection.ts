import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  SceneDesktopScope,
  SceneDesktopSnapshot,
  SceneDesktopState
} from '../../../shared/contracts/scene-desktop.js'
import {
  initialDesktopState,
  reduceDesktop,
  type DesktopAction
} from './desktop-state.js'

export type DesktopProjectionSnapshot = Readonly<{
  state: SceneDesktopState | null
  loading: boolean
  saving: boolean
  error: unknown
  focusWindowId: string | null
}>

let nextMaintenanceId = 0

/** Lifetime is the capability host, not the mounted Scene or route. */
export class DesktopProjection {
  private snapshotValue: DesktopProjectionSnapshot = {
    state: null,
    loading: true,
    saving: false,
    error: null,
    focusWindowId: null
  }
  private readonly listeners = new Set<() => void>()
  private authoritative: SceneDesktopSnapshot | null = null
  private desired: SceneDesktopState | null = null
  private loadRequest: Promise<void> | null = null
  private writeRequest: Promise<void> | null = null
  private recoveryRequest: Promise<void> | null = null
  private failedWrite: {
    state: SceneDesktopState
    revision: number
    before: SceneDesktopSnapshot['state']
  } | null = null
  private unregister: (() => void) | null = null
  private unsubscribeMaintenance: (() => void) | null = null
  private readonly maintenanceId = `scene-desktop:${++nextMaintenanceId}`
  private writeTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly api: SaltMarcherApi['sceneDesktop'],
    private readonly scope: SceneDesktopScope,
    private readonly maintenance: MaintenanceDraftCoordinator = maintenanceDraftCoordinator
  ) {}

  snapshot = (): DesktopProjectionSnapshot => this.snapshotValue
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  requestFocus(windowId: string): void {
    this.publish({ focusWindowId: windowId })
  }

  acknowledgeFocus(windowId: string): void {
    if (this.snapshotValue.focusWindowId === windowId)
      this.publish({ focusWindowId: null })
  }

  private publish(patch: Partial<DesktopProjectionSnapshot>): void {
    this.snapshotValue = { ...this.snapshotValue, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  load(): Promise<void> {
    if (this.loadRequest) return this.loadRequest
    if (this.authoritative) return Promise.resolve()
    this.publish({ loading: true, error: null })
    this.loadRequest = this.api
      .read(this.scope)
      .then((value) => {
        this.authoritative = value
        this.publish({
          state: value.state ?? initialDesktopState(),
          loading: false
        })
      })
      .catch((error: unknown) => {
        this.publish({ loading: false, error })
      })
      .finally(() => {
        this.loadRequest = null
      })
    return this.loadRequest
  }

  dispatch(action: DesktopAction): void {
    if (
      this.maintenance.isLocked() ||
      this.recoveryRequest ||
      !this.authoritative ||
      !this.snapshotValue.state ||
      this.snapshotValue.error
    )
      return
    this.desired = reduceDesktop(this.snapshotValue.state, action)
    this.registerMaintenance()
    this.publish({ state: this.desired })
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = null
    if (
      action.type === 'query' ||
      action.type === 'scroll' ||
      action.type === 'map-view'
    ) {
      this.publish({ saving: true })
      this.writeTimer = setTimeout(() => {
        this.writeTimer = null
        void this.persist()
      }, 200)
    } else void this.persist()
  }

  // Explicit recovery discards only unsaved presentation intent, never domain state.
  reload = (): void => {
    if (
      this.writeRequest ||
      this.recoveryRequest ||
      this.maintenance.isLocked()
    )
      return
    void this.discardPending().catch((error: unknown) =>
      this.publish({ error })
    )
  }

  private clearTimer(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = null
  }

  private dirty = (): boolean =>
    Boolean(
      this.desired ||
      this.writeRequest ||
      this.recoveryRequest ||
      this.failedWrite
    )

  private registerMaintenance(): void {
    if (this.unregister) return
    this.unregister = this.maintenance.register(this.maintenanceId, {
      label: 'Szenendesktop',
      isDirty: this.dirty,
      save: async () => {
        this.clearTimer()
        await this.recoveryRequest
        await this.writeRequest
        await this.reconcileFailedWrite()
        await this.persist(true)
        return !this.dirty()
      },
      discard: async () => {
        await this.discardPending()
        return !this.dirty()
      }
    })
    this.unsubscribeMaintenance = this.maintenance.subscribe(() => {
      if (this.maintenance.isLocked()) this.clearTimer()
      else if (this.desired && !this.snapshotValue.error) void this.persist()
    })
  }

  private releaseIfClean(): void {
    if (this.dirty()) return
    this.unregister?.()
    this.unregister = null
    this.unsubscribeMaintenance?.()
    this.unsubscribeMaintenance = null
  }

  private discardPending(): Promise<void> {
    if (this.recoveryRequest) return this.recoveryRequest
    this.publish({ loading: true })
    const request = this.readDiscardedState()
      .catch((error: unknown) => {
        this.publish({ loading: false, error })
        throw error
      })
      .finally(() => {
        this.recoveryRequest = null
        this.releaseIfClean()
      })
    this.recoveryRequest = request
    this.registerMaintenance()
    return request
  }

  private async readDiscardedState(): Promise<void> {
    this.clearTimer()
    await this.writeRequest
    const fresh = await this.api.read(this.scope)
    this.authoritative = fresh
    this.desired = null
    this.failedWrite = null
    this.publish({
      state: fresh.state ?? initialDesktopState(),
      error: null,
      loading: false,
      saving: false
    })
    this.releaseIfClean()
  }

  private async reconcileFailedWrite(): Promise<void> {
    const failed = this.failedWrite
    if (!failed) return
    const fresh = await this.api.read(this.scope)
    if (sameState(fresh.state, failed.state)) {
      // A completed write is acknowledged, never replayed over later local intent.
    } else if (
      fresh.revision === failed.revision &&
      sameState(fresh.state, failed.before)
    ) {
      this.desired ??= failed.state
    } else {
      throw new Error(
        'Der gespeicherte Szenendesktop hat sich geändert. Bitte die offenen Änderungen verwerfen oder die Wartung abbrechen und den Desktop neu laden.'
      )
    }
    this.authoritative = fresh
    this.failedWrite = null
    this.publish({
      error: null,
      state: this.desired ?? fresh.state ?? initialDesktopState()
    })
    this.releaseIfClean()
  }

  private persist(allowLocked = false): Promise<void> {
    if (this.writeRequest) return this.writeRequest
    if (
      this.snapshotValue.error ||
      this.recoveryRequest ||
      (!allowLocked && this.maintenance.isLocked())
    )
      return Promise.resolve()
    const request = this.write(allowLocked).finally(() => {
      this.writeRequest = null
      this.releaseIfClean()
    })
    this.writeRequest = request
    return request
  }

  private async write(allowLocked: boolean): Promise<void> {
    this.publish({ saving: true })
    try {
      while (
        this.desired &&
        this.authoritative &&
        (allowLocked || !this.maintenance.isLocked())
      ) {
        const state = this.desired
        const before = this.authoritative
        this.desired = null
        try {
          this.authoritative = await this.api.save({
            ...this.scope,
            state,
            expectedRevision: before.revision
          })
        } catch (error) {
          this.failedWrite = {
            state,
            revision: before.revision,
            before: before.state
          }
          // Read before deciding whether a lost response committed; no blind replay.
          const fresh = await this.api.read(this.scope)
          this.authoritative = fresh
          if (!sameState(fresh.state, state)) throw error
          this.failedWrite = null
        }
      }
    } catch (error) {
      this.clearTimer()
      this.publish({ error })
    } finally {
      this.publish({
        saving: Boolean(this.desired) && !this.snapshotValue.error
      })
    }
  }
}

const projections = new WeakMap<
  SaltMarcherApi['sceneDesktop'],
  Map<string, DesktopProjection>
>()
export function desktopProjection(
  api: SaltMarcherApi['sceneDesktop'],
  scope: SceneDesktopScope
): DesktopProjection {
  let entries = projections.get(api)
  if (!entries) {
    entries = new Map()
    projections.set(api, entries)
  }
  const key = `${scope.campaignId}:${scope.sceneId}`
  let projection = entries.get(key)
  if (!projection) {
    projection = new DesktopProjection(api, scope)
    entries.set(key, projection)
  }
  return projection
}

function sameState(
  left: SceneDesktopSnapshot['state'],
  right: SceneDesktopSnapshot['state']
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
