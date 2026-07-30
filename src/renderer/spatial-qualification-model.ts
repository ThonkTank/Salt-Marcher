export interface SpatialQualificationState {
  readonly viewport: Readonly<{
    x: number
    y: number
    width: number
    height: number
  }>
  readonly hoveredChunk: string | null
  readonly selectedChunk: string | null
}

type Listener = (state: SpatialQualificationState) => void

/** Shared spatial truth for the visual fixtures and their text alternative. */
export class SpatialQualificationModel {
  #state: SpatialQualificationState
  readonly #listeners = new Set<Listener>()

  public constructor(initialViewport: SpatialQualificationState['viewport']) {
    this.#state = {
      viewport: initialViewport,
      hoveredChunk: null,
      selectedChunk: null
    }
  }

  public get state(): SpatialQualificationState {
    return this.#state
  }

  public subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  public pan(deltaX: number, deltaY: number): void {
    const viewport = this.#state.viewport
    this.publish({
      ...this.#state,
      viewport: {
        ...viewport,
        x: Math.max(0, viewport.x + deltaX),
        y: Math.max(0, viewport.y + deltaY)
      }
    })
  }

  public hover(chunk: string | null): void {
    this.publish({ ...this.#state, hoveredChunk: chunk })
  }

  public select(chunk: string | null): void {
    this.publish({ ...this.#state, selectedChunk: chunk })
  }

  private publish(next: SpatialQualificationState): void {
    this.#state = next
    for (const listener of this.#listeners) listener(next)
  }
}
