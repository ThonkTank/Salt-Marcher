export interface RendererResourceCounts {
  readonly canvases: number
  readonly meshes: number
  readonly listeners: number
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

  public begin(before: RendererResourceCounts): void {
    this.#before = before
    this.#after = undefined
    this.#rendererBuilds = 0
    this.#rendererDisposals = 0
  }

  public rendererBuilt(): void {
    this.#rendererBuilds += 1
  }

  public get rendererBuilds(): number {
    return this.#rendererBuilds
  }

  public rendererDisposed(): void {
    this.#rendererDisposals += 1
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
      settled: equalCounts(this.#before, this.#after)
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
