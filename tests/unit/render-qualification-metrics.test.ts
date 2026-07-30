import { describe, expect, it } from 'vitest'
import {
  cameraAndHoverBudgetMs,
  InteractionSampler,
  localPreviewBudgetMs,
  p95,
  qualifyInteraction,
  recordedRunCount,
  warmupRunCount
} from '../../src/renderer/spatial-3d/render-qualification-metrics.js'

describe('render qualification metrics', () => {
  it('uses the documented warm-up, population size, and p95 rank', () => {
    expect(warmupRunCount).toBe(5)
    expect(recordedRunCount).toBe(100)
    expect(p95(Array.from({ length: 100 }, (_, index) => index + 1))).toBe(95)
  })

  it('keeps camera/hover and local-preview budgets distinct', () => {
    expect(qualifyInteraction([16], cameraAndHoverBudgetMs).passes).toBe(true)
    expect(qualifyInteraction([16.01], cameraAndHoverBudgetMs).passes).toBe(
      false
    )
    expect(qualifyInteraction([50], localPreviewBudgetMs).passes).toBe(true)
  })

  it('excludes five warm-ups before reporting the 100-sample result', () => {
    const sampler = new InteractionSampler()
    for (
      let index = 0;
      index < warmupRunCount + recordedRunCount - 1;
      index += 1
    ) {
      expect(sampler.record(1)).toBeUndefined()
    }
    expect(sampler.record(1)).toMatchObject({ sampleCount: recordedRunCount })
  })
})
