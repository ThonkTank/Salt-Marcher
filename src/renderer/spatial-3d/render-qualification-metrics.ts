export const cameraAndHoverBudgetMs = 16
export const localPreviewBudgetMs = 50
export const warmupRunCount = 5
export const recordedRunCount = 100
export const requiredQualificationPopulations = [
  'pixiPan',
  'babylonCamera',
  'babylonHoverPick',
  'babylonVoxelPreview'
] as const
export type QualificationPopulation =
  (typeof requiredQualificationPopulations)[number]

export interface QualificationResult {
  readonly sampleCount: number
  readonly p95Ms: number
  readonly budgetMs: number
  readonly passes: boolean
}

export interface FrameMeasurement {
  readonly frameWorkMs: number
  readonly inputToPresentationMs: number
}

/**
 * Accepts exactly one DOM interaction until its next completed render. Keeping
 * the input and renderer boundaries separate prevents VSync wait from being
 * confused with frame work.
 */
export class FrameMeasurementTracker {
  #inputAt: number | undefined
  #inputWorkEndedAt: number | undefined
  #frameStartedAt: number | undefined
  #armed = false

  public begin(inputAt = performance.now()): boolean {
    if (this.#inputAt !== undefined) return false
    this.#inputAt = inputAt
    return true
  }

  public arm(inputWorkEndedAt = performance.now()): void {
    if (this.#inputAt !== undefined) {
      this.#inputWorkEndedAt = inputWorkEndedAt
      this.#armed = true
    }
  }

  public cancel(): void {
    this.#inputAt = undefined
    this.#inputWorkEndedAt = undefined
    this.#frameStartedAt = undefined
    this.#armed = false
  }

  public beforeRender(frameStartedAt = performance.now()): void {
    if (this.#armed && this.#frameStartedAt === undefined)
      this.#frameStartedAt = frameStartedAt
  }

  public afterRender(
    presentedAt = performance.now()
  ): FrameMeasurement | undefined {
    if (
      this.#inputAt === undefined ||
      this.#inputWorkEndedAt === undefined ||
      this.#frameStartedAt === undefined
    )
      return undefined
    const measurement = {
      // The delay between input work ending and the next render is VSync idle
      // time. The budget instead covers input/picking/preparation plus render.
      frameWorkMs:
        this.#inputWorkEndedAt -
        this.#inputAt +
        (presentedAt - this.#frameStartedAt),
      inputToPresentationMs: presentedAt - this.#inputAt
    }
    this.#inputAt = undefined
    this.#inputWorkEndedAt = undefined
    this.#frameStartedAt = undefined
    this.#armed = false
    return measurement
  }
}

export function p95(samples: readonly number[]): number {
  if (samples.length === 0) throw new Error('At least one sample is required')
  const ordered = [...samples].sort((left, right) => left - right)
  const index = Math.ceil(ordered.length * 0.95) - 1
  return ordered[index] ?? 0
}

export function qualifyInteraction(
  samples: readonly number[],
  budgetMs: number
): QualificationResult {
  const p95Ms = p95(samples)
  return {
    sampleCount: samples.length,
    p95Ms,
    budgetMs,
    passes: p95Ms <= budgetMs
  }
}

/** Collects one warm population and one recorded population without pooling them. */
export class InteractionSampler {
  readonly #warmups: number[] = []
  readonly #samples: number[] = []

  public constructor(private readonly budgetMs = cameraAndHoverBudgetMs) {}

  public record(durationMs: number): QualificationResult | undefined {
    if (this.#warmups.length < warmupRunCount) {
      this.#warmups.push(durationMs)
      return undefined
    }
    if (this.#samples.length < recordedRunCount) this.#samples.push(durationMs)
    return this.#samples.length === recordedRunCount
      ? qualifyInteraction(this.#samples, this.budgetMs)
      : undefined
  }

  public get recordedSamples(): number {
    return this.#samples.length
  }

  public get samples(): readonly number[] {
    return [...this.#samples]
  }
}

export function downloadRawQualificationSamples(
  filename: string,
  populations: Readonly<Record<string, readonly number[]>>
): void {
  const artifact = {
    captureKind: 'raw-timing-source',
    recordedAt: new Date().toISOString(),
    environment: {
      userAgent: navigator.userAgent,
      displayWidth: window.screen.width,
      displayHeight: window.screen.height,
      displayScalePercent: window.devicePixelRatio * 100
    },
    populations
  }
  const anchor = document.createElement('a')
  const objectUrl = URL.createObjectURL(
    new Blob([JSON.stringify(artifact, null, 2)], {
      type: 'application/json'
    })
  )
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export function hasCompleteQualificationPopulations(
  populations: Readonly<
    Partial<Record<QualificationPopulation, readonly number[]>>
  >
): populations is Readonly<Record<QualificationPopulation, readonly number[]>> {
  return requiredQualificationPopulations.every(
    (population) => populations[population]?.length === recordedRunCount
  )
}
