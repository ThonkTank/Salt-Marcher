import { describe, expect, it } from 'vitest'
import {
  ListenerRegistrationTracker,
  RendererResourceCycleTracker
} from '../../src/renderer/renderer-resource-cycle.js'

describe('renderer resource cycles', () => {
  it('requires balanced builds and disposals across twenty paired cycles', () => {
    const tracker = new RendererResourceCycleTracker()
    tracker.begin({ canvases: 2, meshes: 26, listeners: 9 })
    for (let cycle = 0; cycle < 20; cycle += 1) {
      tracker.rendererBuilt()
      tracker.rendererBuilt()
      tracker.rendererDisposed({ canvases: 0, meshes: 0, listeners: 0 })
      tracker.rendererDisposed({ canvases: 0, meshes: 0, listeners: 0 })
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
    tracker.rendererDisposed({ canvases: 0, meshes: 0, listeners: 0 })
    tracker.rendererDisposed({ canvases: 0, meshes: 0, listeners: 0 })

    expect(
      tracker.finish({ canvases: 3, meshes: 26, listeners: 9 }).settled
    ).toBe(false)
  })

  it('observes and disposes each registered listener exactly once', () => {
    const listeners = new ListenerRegistrationTracker()
    let removals = 0
    listeners.track(() => {
      removals += 1
    })
    listeners.track(() => {
      removals += 1
    })

    expect(listeners.count).toBe(2)
    listeners.dispose()
    listeners.dispose()
    expect(listeners.count).toBe(0)
    expect(removals).toBe(2)
  })

  it('fails a cycle when teardown leaves a mesh or registered listener live', () => {
    const tracker = new RendererResourceCycleTracker()
    tracker.begin({ canvases: 2, meshes: 26, listeners: 12 })
    tracker.rendererBuilt()
    tracker.rendererBuilt()
    tracker.rendererDisposed({ canvases: 1, meshes: 1, listeners: 0 })
    tracker.rendererDisposed({ canvases: 1, meshes: 0, listeners: 0 })

    expect(
      tracker.finish({ canvases: 2, meshes: 26, listeners: 12 }).settled
    ).toBe(false)
  })
})
