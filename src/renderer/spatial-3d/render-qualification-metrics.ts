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
