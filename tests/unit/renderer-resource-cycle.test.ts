import { describe, expect, it } from 'vitest'
import { RendererResourceCycleTracker } from '../../src/renderer/renderer-resource-cycle.js'

describe('renderer resource cycles', () => {
  it('requires balanced builds and disposals across twenty paired cycles', () => {
    const tracker = new RendererResourceCycleTracker()
    tracker.begin({ canvases: 2, meshes: 26, listeners: 9 })
    for (let cycle = 0; cycle < 20; cycle += 1) {
      tracker.rendererBuilt()
      tracker.rendererBuilt()
      tracker.rendererDisposed()
      tracker.rendererDisposed()
    }

    expect(
      tracker.finish({ canvases: 2, meshes: 26, listeners: 9 })
    ).toMatchObject({
      rendererCycles: 20,
      rendererBuilds: 40,
      rendererDisposals: 40,
      settled: true
    })
  })

  it('reports a resource-count leak after otherwise balanced cycles', () => {
    const tracker = new RendererResourceCycleTracker()
    tracker.begin({ canvases: 2, meshes: 26, listeners: 9 })
    tracker.rendererBuilt()
    tracker.rendererBuilt()
    tracker.rendererDisposed()
    tracker.rendererDisposed()

    expect(
      tracker.finish({ canvases: 3, meshes: 26, listeners: 9 }).settled
    ).toBe(false)
  })
})
