import { describe, expect, it, vi } from 'vitest'
import { AsyncCommandCoordinator } from '../../src/renderer/features/shared/async-command-coordinator.js'

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
