export interface RendererResourceCounts {
  readonly canvases: number
  readonly meshes: number
  readonly listeners: number
}

export type QualificationRenderer = 'pixi' | 'babylon'

/** Tracks listeners registered by a qualification view and removes exactly
 * those registrations during teardown. Its count is an observation of live
 * registrations, rather than a view's asserted constant. */
export class ListenerRegistrationTracker {
  readonly #removers = new Set<() => void>()

  public listen<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    const eventListener = listener as EventListener
    target.addEventListener(type, eventListener, options)
    this.track(() => target.removeEventListener(type, eventListener, options))
  }

  public listenWindow<K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void
  ): void {
    window.addEventListener(type, listener)
    this.track(() => window.removeEventListener(type, listener))
  }

  public track(remove: () => void): void {
    let active = true
    this.#removers.add(() => {
      if (!active) return
      active = false
      remove()
    })
  }

  public get count(): number {
    return this.#removers.size
  }

  public dispose(): void {
    for (const remove of this.#removers) remove()
    this.#removers.clear()
  }
}

export interface RendererCycleResult {
  readonly rendererCycles: number
  readonly rendererBuilds: number
  readonly rendererDisposals: number
  readonly before: RendererResourceCounts
  readonly after: RendererResourceCounts
  readonly settled: boolean
}

/**
 * Captures the actual lifecycle notifications emitted by both renderer views.
 * It deliberately treats a balanced counter as an observation, not a memory
 * qualification verdict; process-memory evidence remains machine-specific.
 */
export class RendererResourceCycleTracker {
  #before: RendererResourceCounts | undefined
  #after: RendererResourceCounts | undefined
  #rendererBuilds = 0
  #rendererDisposals = 0
  #allDisposalsSettled = true

  public begin(before: RendererResourceCounts): void {
    this.#before = before
    this.#after = undefined
    this.#rendererBuilds = 0
    this.#rendererDisposals = 0
    this.#allDisposalsSettled = true
  }

  public rendererBuilt(): void {
    this.#rendererBuilds += 1
  }

  public get rendererBuilds(): number {
    return this.#rendererBuilds
  }

  public rendererDisposed(afterDispose: RendererResourceCounts): void {
    this.#rendererDisposals += 1
    if (afterDispose.meshes !== 0 || afterDispose.listeners !== 0)
      this.#allDisposalsSettled = false
  }

  public finish(after: RendererResourceCounts): RendererCycleResult {
    if (this.#before === undefined)
      throw new Error('A renderer resource cycle must have a baseline')
    this.#after = after
    return {
      rendererCycles: Math.min(
        Math.floor(this.#rendererBuilds / 2),
        Math.floor(this.#rendererDisposals / 2)
      ),
      rendererBuilds: this.#rendererBuilds,
      rendererDisposals: this.#rendererDisposals,
      before: this.#before,
      after: this.#after,
      settled:
        this.#allDisposalsSettled && equalCounts(this.#before, this.#after)
    }
  }
}

function equalCounts(
  left: RendererResourceCounts,
  right: RendererResourceCounts
): boolean {
  return (
    left.canvases === right.canvases &&
    left.meshes === right.meshes &&
    left.listeners === right.listeners
  )
}
