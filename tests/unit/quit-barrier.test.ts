import { describe, expect, it, vi } from 'vitest'
import { registerQuitBarrier } from '../../src/main/application-lifecycle/quit-barrier.js'

describe('application quit barrier', () => {
  it('prevents repeated quit requests until the data process has closed', async () => {
    let finish!: () => void
    const stop = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    let listener!: (event: { preventDefault(): void }) => void
    const finalPrevent = vi.fn()
    const host = {
      on: (_event: 'before-quit', accept: typeof listener) => {
        listener = accept
      },
      quit: vi.fn(() => listener({ preventDefault: finalPrevent }))
    }
    registerQuitBarrier(host, stop, vi.fn())
    const first = vi.fn(),
      second = vi.fn()
    listener({ preventDefault: first })
    listener({ preventDefault: second })
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
    expect(host.quit).not.toHaveBeenCalled()
    finish()
    await Promise.resolve()
    expect(host.quit).toHaveBeenCalledOnce()
    expect(finalPrevent).not.toHaveBeenCalled()
  })

  it('keeps quit blocked after a stop failure and permits a later retry', async () => {
    let listener!: (event: { preventDefault(): void }) => void
    const failed = vi.fn()
    const stop = vi
      .fn()
      .mockRejectedValueOnce(new Error('still alive'))
      .mockResolvedValueOnce(undefined)
    const host = {
      on: (_event: 'before-quit', accept: typeof listener) => {
        listener = accept
      },
      quit: vi.fn()
    }
    registerQuitBarrier(host, stop, failed)
    listener({ preventDefault: vi.fn() })
    await Promise.resolve()
    expect(host.quit).not.toHaveBeenCalled()
    expect(failed).toHaveBeenCalledOnce()
    const retry = vi.fn()
    listener({ preventDefault: retry })
    expect(retry).toHaveBeenCalledOnce()
    await Promise.resolve()
    expect(host.quit).toHaveBeenCalledOnce()
  })
})
