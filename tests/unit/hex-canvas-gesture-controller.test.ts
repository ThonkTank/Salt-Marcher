import { describe, expect, it, vi } from 'vitest'
import { attachHexCanvasGestures } from '../../src/renderer/features/hex/hex-canvas-gesture-controller.js'

type Listener = (event: never) => void

function canvasHarness() {
  const listeners = new Map<string, Set<Listener>>()
  const canvas = {
    addEventListener(type: string, listener: Listener) {
      const registered = listeners.get(type) ?? new Set()
      registered.add(listener)
      listeners.set(type, registered)
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener)
    },
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn()
  } as unknown as HTMLCanvasElement
  return {
    canvas,
    dispatch(type: string, event: object) {
      for (const listener of listeners.get(type) ?? [])
        listener({ preventDefault: vi.fn(), ...event } as never)
    },
    listenerCount: () =>
      [...listeners.values()].reduce((total, group) => total + group.size, 0)
  }
}

describe('hex canvas gesture controller', () => {
  it('owns stroke state and emits each visited coordinate once', () => {
    const harness = canvasHarness()
    const previews: string[][] = []
    const completed: string[][] = []
    const detach = attachHexCanvasGestures({
      canvas: harness.canvas,
      interaction: () => 'paint',
      coordinateFor: (event) => ({ q: event.clientX, r: event.clientY }),
      onPan: vi.fn(),
      onPanEnd: vi.fn(),
      onStrokePreview: (path) =>
        previews.push(path.map(({ q, r }) => `${q}:${r}`)),
      onStrokeComplete: (path) =>
        completed.push(path.map(({ q, r }) => `${q}:${r}`)),
      onStrokeCancel: vi.fn(),
      onSelect: vi.fn(),
      onZoom: vi.fn()
    })

    harness.dispatch('pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: 2,
      clientY: 3
    })
    harness.dispatch('pointermove', { clientX: 2, clientY: 3 })
    harness.dispatch('pointermove', { clientX: 4, clientY: 5 })
    harness.dispatch('pointerup', { pointerId: 1 })

    expect(previews).toEqual([['2:3'], ['2:3', '4:5'], []])
    expect(completed).toEqual([['2:3', '4:5']])
    detach()
    expect(harness.listenerCount()).toBe(0)
  })

  it('separates pan, selection and zoom gestures', () => {
    const harness = canvasHarness()
    const pan = vi.fn()
    const panEnd = vi.fn()
    const select = vi.fn()
    const zoom = vi.fn()
    attachHexCanvasGestures({
      canvas: harness.canvas,
      interaction: () => 'select',
      coordinateFor: (event) => ({ q: event.clientX, r: event.clientY }),
      onPan: pan,
      onPanEnd: panEnd,
      onStrokePreview: vi.fn(),
      onStrokeComplete: vi.fn(),
      onStrokeCancel: vi.fn(),
      onSelect: select,
      onZoom: zoom
    })

    harness.dispatch('pointerdown', {
      button: 1,
      pointerId: 2,
      clientX: 10,
      clientY: 20
    })
    harness.dispatch('pointermove', { clientX: 14, clientY: 18 })
    harness.dispatch('pointerup', { pointerId: 2 })
    harness.dispatch('click', { button: 0, clientX: 7, clientY: 9 })
    harness.dispatch('wheel', { deltaY: -1 })

    expect(pan).toHaveBeenCalledWith(4, -2)
    expect(panEnd).toHaveBeenCalledOnce()
    expect(select).toHaveBeenCalledWith({ q: 7, r: 9 })
    expect(zoom).toHaveBeenCalledOnce()
  })
})
