export const cameraAndHoverBudgetMs = 16
export const localPreviewBudgetMs = 50
export const warmupRunCount = 5
export const recordedRunCount = 100

export interface QualificationResult {
  readonly sampleCount: number
  readonly p95Ms: number
  readonly budgetMs: number
  readonly passes: boolean
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
}
