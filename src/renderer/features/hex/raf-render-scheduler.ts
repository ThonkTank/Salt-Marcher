export type RenderInvalidationReason = 'scene' | 'camera' | 'overlay' | 'resize'

export interface AnimationFramePort {
  request(callback: FrameRequestCallback): number
  cancel(frame: number): void
}

const browserAnimationFrames: AnimationFramePort = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (frame) => cancelAnimationFrame(frame)
}

export class RafRenderScheduler {
  #frame: number | null = null
  #disposed = false
  #active = true
  readonly #reasons = new Set<RenderInvalidationReason>()

  constructor(
    private readonly render: (
      reasons: readonly RenderInvalidationReason[]
    ) => void,
    private readonly frames: AnimationFramePort = browserAnimationFrames
  ) {}

  invalidate(reason: RenderInvalidationReason): void {
    if (this.#disposed) return
    this.#reasons.add(reason)
    if (!this.#active || this.#frame !== null) return
    this.#frame = this.frames.request(() => {
      this.#frame = null
      if (this.#disposed) return
      const reasons = Object.freeze([...this.#reasons])
      this.#reasons.clear()
      this.render(reasons)
    })
  }

  setActive(active: boolean): void {
    if (this.#disposed || active === this.#active) return
    this.#active = active
    if (!active) {
      if (this.#frame !== null) this.frames.cancel(this.#frame)
      this.#frame = null
    } else if (this.#reasons.size) this.invalidate([...this.#reasons][0]!)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#reasons.clear()
    if (this.#frame !== null) this.frames.cancel(this.#frame)
    this.#frame = null
  }
}
