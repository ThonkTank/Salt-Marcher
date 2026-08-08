import { describe, expect, it } from 'vitest'
import { HexCommandQueue } from '../../src/renderer/features/hex/hex-command-queue.js'

describe('HexCommandQueue', () => {
  it('runs rapid writes sequentially and continues after a rejection', async () => {
    const queue = new HexCommandQueue()
    const order: string[] = []
    let releaseFirst: () => void = () => undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const first = queue.enqueue(async () => {
      order.push('first:start')
      await firstGate
      order.push('first:end')
    })
    const second = queue.enqueue(() => {
      order.push('second')
      return Promise.reject(new Error('expected'))
    })
    const third = queue.enqueue(() => {
      order.push('third')
      return Promise.resolve(3)
    })
    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    releaseFirst()
    await first
    await expect(second).rejects.toThrow('expected')
    await expect(third).resolves.toBe(3)
    expect(order).toEqual(['first:start', 'first:end', 'second', 'third'])
  })
})
