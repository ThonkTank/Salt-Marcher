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
}>

/** Lifetime is the capability host, not the mounted Scene or route. */
export class DesktopProjection {
  private snapshotValue: DesktopProjectionSnapshot = {
    state: null,
    loading: true,
    saving: false,
    error: null
  }
  private readonly listeners = new Set<() => void>()
  private authoritative: SceneDesktopSnapshot | null = null
  private desired: SceneDesktopState | null = null
  private loadRequest: Promise<void> | null = null
  private saving = false

  constructor(
    private readonly api: SaltMarcherApi['sceneDesktop'],
    private readonly scope: SceneDesktopScope
  ) {}

  snapshot = (): DesktopProjectionSnapshot => this.snapshotValue
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
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
      !this.authoritative ||
      !this.snapshotValue.state ||
      this.snapshotValue.error
    )
      return
    this.desired = reduceDesktop(this.snapshotValue.state, action)
    this.publish({ state: this.desired })
    void this.persist()
  }

  // Explicit recovery discards only unsaved presentation intent, never domain state.
  reload = (): void => {
    if (this.saving) return
    this.desired = null
    this.authoritative = null
    void this.load()
  }

  private async persist(): Promise<void> {
    if (this.saving) return
    this.saving = true
    this.publish({ saving: true })
    try {
      while (this.desired && this.authoritative) {
        const state = this.desired
        this.desired = null
        try {
          this.authoritative = await this.api.save({
            ...this.scope,
            state,
            expectedRevision: this.authoritative.revision
          })
        } catch (error) {
          // A lost response may have committed. Read back before deciding whether
          // to continue; never replay a stale full desktop over another writer.
          const fresh = await this.api.read(this.scope)
          this.authoritative = fresh
          if (JSON.stringify(fresh.state) !== JSON.stringify(state)) throw error
        }
      }
    } catch (error) {
      this.publish({ error })
    } finally {
      this.saving = false
      this.publish({ saving: false })
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
