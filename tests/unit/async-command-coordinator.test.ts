import { describe, expect, it, vi } from 'vitest'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'

describe('async command coordinator', () => {
  it('marks an older latest-only result stale without replacing newer state', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const older = deferred<number>()
    const newer = deferred<number>()
    const first = coordinator.run({
      scope: 'projection',
      entityKey: 'group-a',
      mode: 'latest-only',
      execute: () => older.promise
    })
    const second = coordinator.run({
      scope: 'projection',
      entityKey: 'group-a',
      mode: 'latest-only',
      execute: () => newer.promise
    })

    newer.resolve(2)
    expect(await second).toMatchObject({ status: 'success', value: 2 })
    older.resolve(1)
    expect(await first).toMatchObject({
      status: 'stale',
      reason: 'aborted'
    })
    expect(
      coordinator.state({ scope: 'projection', entityKey: 'group-a' })
    ).toMatchObject({ status: 'success', token: { requestId: 2 } })
  })

  it('isolates entity keys and converts an obsolete failure to stale', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const stale = deferred<number>()
    const replacement = deferred<number>()
    const other = deferred<number>()
    const first = coordinator.run({
      scope: 'projection',
      entityKey: 'group-a',
      mode: 'latest-only',
      execute: () => stale.promise
    })
    const independent = coordinator.run({
      scope: 'projection',
      entityKey: 'group-b',
      mode: 'latest-only',
      execute: () => other.promise
    })
    const second = coordinator.run({
      scope: 'projection',
      entityKey: 'group-a',
      mode: 'latest-only',
      execute: () => replacement.promise
    })

    stale.reject(new Error('obsolete'))
    replacement.resolve(2)
    other.resolve(3)
    expect(await first).toMatchObject({ status: 'stale' })
    expect(await second).toMatchObject({ status: 'success', value: 2 })
    expect(await independent).toMatchObject({ status: 'success', value: 3 })
  })

  it('reports external cancellation as stale even when work ignores the signal', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const abort = new AbortController()
    const delayed = deferred<number>()
    const outcome = coordinator.run({
      scope: 'projection',
      mode: 'latest-only',
      signal: abort.signal,
      execute: () => delayed.promise
    })
    abort.abort()
    delayed.resolve(1)

    expect(await outcome).toMatchObject({
      status: 'stale',
      reason: 'aborted'
    })
    expect(coordinator.state({ scope: 'projection' })).toMatchObject({
      status: 'stale',
      reason: 'aborted'
    })
  })

  it('serializes queued commands without sleeps', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const firstGate = deferred<void>()
    const calls: string[] = []
    const first = coordinator.run({
      scope: 'write',
      mode: 'queue',
      execute: async () => {
        calls.push('first-start')
        await firstGate.promise
        calls.push('first-end')
        return 1
      }
    })
    const secondExecute = vi.fn(() => {
      calls.push('second')
      return Promise.resolve(2)
    })
    const second = coordinator.run({
      scope: 'write',
      mode: 'queue',
      execute: secondExecute
    })
    await Promise.resolve()
    expect(calls).toEqual(['first-start'])
    expect(secondExecute).not.toHaveBeenCalled()

    firstGate.resolve()
    expect(await first).toMatchObject({ status: 'success', value: 1 })
    expect(await second).toMatchObject({ status: 'success', value: 2 })
    expect(calls).toEqual(['first-start', 'first-end', 'second'])
  })

  it('continues a scoped queue after failure without leaking that failure', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const firstGate = deferred<void>()
    const order: string[] = []
    const first = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: async () => {
        order.push('first:start')
        await firstGate.promise
        order.push('first:failure')
        throw new Error('expected')
      }
    })
    const second = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: () => {
        order.push('second')
        return Promise.resolve(Object.freeze({ revision: 2 }))
      }
    })

    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    firstGate.resolve()
    const failedOutcome = await first
    expect(failedOutcome.status).toBe('failure')
    if (failedOutcome.status !== 'failure') throw new Error('Expected failure')
    expect(failedOutcome.cause).toBeInstanceOf(Error)
    expect((failedOutcome.cause as Error).message).toBe('expected')
    expect(await second).toMatchObject({
      status: 'success',
      value: { revision: 2 }
    })
    expect(order).toEqual(['first:start', 'first:failure', 'second'])
  })

  it('runs different entity queues independently while preserving each FIFO', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const mapAGate = deferred<void>()
    const mapBGate = deferred<void>()
    const order: string[] = []
    const mapAFirst = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: async () => {
        order.push('a:first:start')
        await mapAGate.promise
        order.push('a:first:end')
        return 'a:first'
      }
    })
    const mapASecond = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: () => {
        order.push('a:second')
        return Promise.resolve('a:second')
      }
    })
    const mapB = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:b',
      mode: 'queue',
      execute: async () => {
        order.push('b:start')
        await mapBGate.promise
        order.push('b:end')
        return 'b'
      }
    })

    await Promise.resolve()
    expect(order).toEqual(['a:first:start', 'b:start'])
    expect(order).not.toContain('a:second')
    mapBGate.resolve()
    expect(await mapB).toMatchObject({ status: 'success', value: 'b' })
    expect(order).not.toContain('a:second')
    mapAGate.resolve()
    await expect(mapAFirst).resolves.toMatchObject({ status: 'success' })
    await expect(mapASecond).resolves.toMatchObject({ status: 'success' })
    expect(order).toEqual([
      'a:first:start',
      'b:start',
      'b:end',
      'a:first:end',
      'a:second'
    ])
  })

  it('drops an externally aborted queued command before its transport runs', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const gate = deferred<void>()
    const abort = new AbortController()
    const transport = vi.fn(() => Promise.resolve('obsolete'))
    const first = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: () => gate.promise
    })
    const canceled = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      signal: abort.signal,
      execute: transport
    })

    abort.abort('scope-changed')
    gate.resolve()
    await expect(first).resolves.toMatchObject({ status: 'success' })
    await expect(canceled).resolves.toMatchObject({
      status: 'stale',
      reason: 'aborted'
    })
    expect(transport).not.toHaveBeenCalled()
  })

  it('accepts a result before starting the next command in the same queue', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const acceptanceGate = deferred<void>()
    const order: string[] = []
    const first = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: () => {
        order.push('first:transport')
        return Promise.resolve(Object.freeze({ revision: 1 }))
      },
      accept: async () => {
        order.push('first:accept:start')
        await acceptanceGate.promise
        order.push('first:accept:end')
      }
    })
    const second = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: () => {
        order.push('second:transport')
        return Promise.resolve(Object.freeze({ revision: 2 }))
      }
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['first:transport', 'first:accept:start'])
    acceptanceGate.resolve()
    await expect(first).resolves.toMatchObject({ status: 'success' })
    await expect(second).resolves.toMatchObject({ status: 'success' })
    expect(order).toEqual([
      'first:transport',
      'first:accept:start',
      'first:accept:end',
      'second:transport'
    ])
  })

  it('does not accept a transport result made stale by cancellation', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const transport = deferred<Readonly<{ revision: number }>>()
    const accept = vi.fn()
    const command = coordinator.run({
      scope: 'hex.write',
      entityKey: 'map:a',
      mode: 'queue',
      execute: () => transport.promise,
      accept
    })

    await Promise.resolve()
    coordinator.cancelAll()
    transport.resolve(Object.freeze({ revision: 1 }))
    await expect(command).resolves.toMatchObject({
      status: 'stale',
      reason: 'aborted'
    })
    expect(accept).not.toHaveBeenCalled()
  })
})

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<Value>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
