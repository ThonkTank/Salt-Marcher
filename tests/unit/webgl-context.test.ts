import { describe, expect, it, vi } from 'vitest'
import { exerciseWebglContextLoss } from '../../src/renderer/spatial-3d/webgl-context.js'

describe('WebGL context-loss exercise', () => {
  it('uses the browser loss extension and schedules restoration', () => {
    vi.useFakeTimers()
    const loseContext = vi.fn()
    const restoreContext = vi.fn()
    const canvas = {
      getContext: vi.fn(() => ({
        getExtension: () => ({ loseContext, restoreContext })
      }))
    } as unknown as HTMLCanvasElement

    expect(exerciseWebglContextLoss(canvas)).toBe(true)
    expect(loseContext).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(250)
    expect(restoreContext).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('reports when a device cannot exercise context loss', () => {
    const canvas = {
      getContext: () => null
    } as unknown as HTMLCanvasElement
    expect(exerciseWebglContextLoss(canvas)).toBe(false)
  })

  it('does not accept WebGL 1 as the WebGL 2 qualification baseline', () => {
    const canvas = {
      getContext: (kind: string) =>
        kind === 'webgl2'
          ? null
          : {
              getExtension: () => ({
                loseContext: vi.fn(),
                restoreContext: vi.fn()
              })
            }
    } as unknown as HTMLCanvasElement
    expect(exerciseWebglContextLoss(canvas)).toBe(false)
  })
})
