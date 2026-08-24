import { describe, expect, it, vi } from 'vitest'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { KeyedReadProjectionOwner } from '../../src/renderer/async/keyed-read-projection-owner.js'
import type { ReadProjectionExecution } from '../../src/renderer/async/renderer-execution-contract.js'
import type { CapabilityOperation } from '../../src/shared/contracts/capability-api.js'

type Projection = Readonly<{ revision: number; label: string }>
type ReadProjection = CapabilityOperation<'read', readonly [], Projection>

describe('Keyed read projection owner', () => {
  it('deduplicates concurrent reads for the same authority', async () => {
    const pending = deferred<Projection>()
    const read = vi.fn(() => pending.promise) as ReadProjection
    const owner = projectionOwner()
    const descriptor = execution('a', read)

    const first = owner.ensure(descriptor)
    const second = owner.ensure(descriptor)

    expect(first).toBe(second)
    expect(read).toHaveBeenCalledTimes(1)
    pending.resolve(projection(1, 'accepted'))
    await expect(first).resolves.toMatchObject({
      status: 'accepted',
      value: projection(1, 'accepted')
    })
    await expect(second).resolves.toMatchObject({ status: 'accepted' })
    expect(owner.snapshot(descriptor.authority)).toMatchObject({
      status: 'ready',
      revision: 1,
      value: projection(1, 'accepted')
    })
  })

  it('keeps a newer invalidation result when the older transport settles last', async () => {
    const older = deferred<Projection>()
    const newer = deferred<Projection>()
    const read = vi
      .fn<ReadProjection>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
    const owner = projectionOwner()
    const descriptor = execution('a', read)

    const first = owner.ensure(descriptor)
    const second = owner.invalidate(descriptor)
    newer.resolve(projection(2, 'newer'))
    await expect(second).resolves.toMatchObject({ status: 'accepted' })
    older.resolve(projection(1, 'older'))
    await expect(first).resolves.toMatchObject({ status: 'stale' })
    expect(owner.current(descriptor.authority)).toEqual(projection(2, 'newer'))
  })

  it('isolates entity keys and their subscriptions', () => {
    const owner = projectionOwner()
    const authorityA = execution('a', vi.fn() as ReadProjection).authority
    const authorityB = execution('b', vi.fn() as ReadProjection).authority
    const notifiedA = vi.fn()
    owner.subscribe(authorityA, notifiedA)

    owner.publish(authorityB, projection(1, 'b'))

    expect(notifiedA).not.toHaveBeenCalled()
    expect(owner.current(authorityA)).toBeNull()
    expect(owner.current(authorityB)).toEqual(projection(1, 'b'))
  })

  it('rejects a lower revision and restores the accepted cached snapshot', async () => {
    const read = vi.fn(() =>
      Promise.resolve(projection(4, 'old'))
    ) as ReadProjection
    const owner = projectionOwner()
    const descriptor = execution('a', read)
    owner.publish(descriptor.authority, projection(5, 'current'))

    await expect(owner.invalidate(descriptor)).resolves.toEqual({
      status: 'stale',
      reason: 'older-revision'
    })
    expect(owner.snapshot(descriptor.authority)).toMatchObject({
      status: 'ready',
      revision: 5,
      value: projection(5, 'current')
    })
  })

  it('retains the last accepted value when a refresh fails', async () => {
    const cause = new Error('offline')
    const read = vi.fn(() => Promise.reject(cause)) as ReadProjection
    const owner = projectionOwner()
    const descriptor = execution('a', read)
    owner.publish(descriptor.authority, projection(3, 'cached'))

    await expect(owner.invalidate(descriptor)).resolves.toEqual({
      status: 'failure',
      cause
    })
    expect(owner.snapshot(descriptor.authority)).toMatchObject({
      status: 'failure',
      revision: 3,
      value: projection(3, 'cached'),
      cause
    })
  })

  it('does not publish a pending read after owner disposal', async () => {
    const pending = deferred<Projection>()
    const read = vi.fn(() => pending.promise) as ReadProjection
    const owner = projectionOwner()
    const descriptor = execution('a', read)
    const outcome = owner.ensure(descriptor)

    owner.dispose()
    pending.resolve(projection(1, 'late'))

    await expect(outcome).resolves.toMatchObject({
      status: 'stale',
      reason: 'aborted'
    })
    expect(owner.current(descriptor.authority)).toBeNull()
    await expect(owner.ensure(descriptor)).resolves.toEqual({
      status: 'stale',
      reason: 'aborted'
    })
    expect(read).toHaveBeenCalledTimes(1)
  })
})

function projectionOwner(): KeyedReadProjectionOwner<Projection> {
  return new KeyedReadProjectionOwner(
    new AsyncCommandCoordinator(),
    (value) => value.revision
  )
}

function execution(
  entityKey: string,
  operation: ReadProjection
): ReadProjectionExecution<ReadProjection, 'test.projection'> {
  return Object.freeze({
    kind: 'read-projection',
    authority: Object.freeze({ scope: 'test.projection', entityKey }),
    operation
  })
}

function projection(revision: number, label: string): Projection {
  return Object.freeze({ revision, label })
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  const promise = new Promise<Value>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
