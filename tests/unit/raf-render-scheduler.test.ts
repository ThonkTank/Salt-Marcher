import { describe, expect, it, vi } from 'vitest'
import {
  RafRenderScheduler,
  type AnimationFramePort,
  type RenderInvalidationReason
} from '../../src/renderer/features/hex/raf-render-scheduler.js'

function harness() {
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  const request = vi.fn((callback: FrameRequestCallback): number => {
    nextFrame += 1
    frames.set(nextFrame, callback)
    return nextFrame
  })
  const cancel = vi.fn((frame: number): void => {
    frames.delete(frame)
  })
  const port: AnimationFramePort = { request, cancel }
  const render = vi.fn<(reasons: readonly RenderInvalidationReason[]) => void>()
  const scheduler = new RafRenderScheduler(render, port)
  const run = (frame: number) => {
    const callback = frames.get(frame)
    if (!callback) throw new Error(`Frame ${frame} is not scheduled`)
    frames.delete(frame)
    callback(frame * 16)
  }
  return { scheduler, request, cancel, render, frames, run }
}

describe('RAF render scheduler', () => {
  it('coalesces every pending invalidation into one frame', () => {
    const { scheduler, request, render, run } = harness()
    scheduler.invalidate('scene')
    scheduler.invalidate('camera')
    scheduler.invalidate('overlay')

    expect(request).toHaveBeenCalledTimes(1)
    run(1)
    expect(render).toHaveBeenCalledWith(['scene', 'camera', 'overlay'])
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('schedules a later frame only after a new invalidation', () => {
    const { scheduler, request, render, run } = harness()
    scheduler.invalidate('scene')
    run(1)
    expect(render).toHaveBeenCalledTimes(1)

    scheduler.invalidate('resize')
    expect(request).toHaveBeenCalledTimes(2)
    run(2)
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('cancels pending work and ignores invalidation after disposal', () => {
    const { scheduler, request, cancel, render, frames } = harness()
    scheduler.invalidate('scene')
    scheduler.dispose()
    scheduler.invalidate('camera')

    expect(cancel).toHaveBeenCalledWith(1)
    expect(frames.size).toBe(0)
    expect(render).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledTimes(1)
  })
})
