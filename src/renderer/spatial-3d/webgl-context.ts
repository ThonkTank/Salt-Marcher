export interface LoseContextExtension {
  loseContext(): void
  restoreContext(): void
}

export interface ContextRecoveryRecord {
  readonly lossRequested: boolean
  readonly lossObserved: boolean
  readonly restorationObserved: boolean
  readonly rerendered: boolean
  readonly nextInteractionSucceeded: boolean
}

/**
 * Records the observable recovery milestones; a loss request alone is never
 * considered successful recovery evidence.
 */
export class ContextRecoveryTracker {
  #record: ContextRecoveryRecord = {
    lossRequested: false,
    lossObserved: false,
    restorationObserved: false,
    rerendered: false,
    nextInteractionSucceeded: false
  }
  #completedCycles = 0

  public get record(): ContextRecoveryRecord {
    return this.#record
  }

  public get completedCycles(): number {
    return this.#completedCycles
  }

  public requested(): void {
    if (this.#record.lossRequested)
      this.#record = {
        lossRequested: false,
        lossObserved: false,
        restorationObserved: false,
        rerendered: false,
        nextInteractionSucceeded: false
      }
    this.#record = { ...this.#record, lossRequested: true }
  }

  public observedLoss(): void {
    if (this.#record.lossRequested)
      this.#record = { ...this.#record, lossObserved: true }
  }

  public observedRestoration(): void {
    if (this.#record.lossObserved)
      this.#record = { ...this.#record, restorationObserved: true }
  }

  public observedRerender(): void {
    if (this.#record.restorationObserved)
      this.#record = { ...this.#record, rerendered: true }
  }

  public observedNextInteraction(): void {
    if (this.#record.rerendered && !this.#record.nextInteractionSucceeded) {
      this.#record = { ...this.#record, nextInteractionSucceeded: true }
      this.#completedCycles += 1
    }
  }
}

/** Exercises the browser's real WebGL loss/restoration path when available. */
export function exerciseWebglContextLoss(
  canvas: HTMLCanvasElement,
  onRequested?: () => void
): boolean {
  const context = canvas.getContext('webgl2')
  const extension = context?.getExtension(
    'WEBGL_lose_context'
  ) as LoseContextExtension | null
  if (extension === null || extension === undefined) return false
  onRequested?.()
  extension.loseContext()
  globalThis.setTimeout(() => extension.restoreContext(), 250)
  return true
}

export function webgl2Description(
  canvas: HTMLCanvasElement
): string | undefined {
  const context = canvas.getContext('webgl2')
  if (context === null) return undefined
  return context.getParameter(context.VERSION) as string
}
