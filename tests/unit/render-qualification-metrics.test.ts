import { describe, expect, it } from 'vitest'
import {
  cameraAndHoverBudgetMs,
  FrameMeasurementTracker,
  hasCompleteQualificationPopulations,
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

  it('counts interaction preparation and rendering but excludes VSync wait', () => {
    const tracker = new FrameMeasurementTracker()
    expect(tracker.begin(10)).toBe(true)
    expect(tracker.begin(11)).toBe(false)
    tracker.arm(18)
    tracker.beforeRender(20)
    expect(tracker.afterRender(25)).toEqual({
      frameWorkMs: 13,
      inputToPresentationMs: 15
    })
  })

  it('only enables combined export after every named population has 100 samples', () => {
    const samples = Array.from({ length: recordedRunCount }, () => 1)
    expect(
      hasCompleteQualificationPopulations({
        pixiPan: samples,
        babylonCamera: samples,
        babylonHoverPick: samples
      })
    ).toBe(false)
    expect(
      hasCompleteQualificationPopulations({
        pixiPan: samples,
        babylonCamera: samples,
        babylonHoverPick: samples,
        babylonVoxelPreview: samples
      })
    ).toBe(true)
  })
})
