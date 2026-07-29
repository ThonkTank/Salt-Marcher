import { describe, expect, it } from 'vitest'
import {
  cameraAndHoverBudgetMs,
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
})
