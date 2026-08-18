import { describe, expect, it, vi } from 'vitest'
import type { CoreHandlers } from '../../src/shared/contracts/core-protocol.js'
import { startUtilityDispatcher } from '../../src/utility/runtime-dispatcher.js'

describe('utility runtime dispatcher', () => {
  it('reports diagnostics without invoking a domain handler', () => {
    const harness = runtimeHarness()
    harness.send({
      kind: 'core.control',
      requestId: '018f1f9c-4f5e-8a12-9234-123456789abc',
      control: 'runtime-metrics'
    })
    expect(harness.posts).toHaveLength(1)
    expect(harness.posts[0]).toMatchObject({ kind: 'core.diagnostics' })
    expect(harness.afterOperation).not.toHaveBeenCalled()
  })

  it('fails closed for an unknown operation in an otherwise valid envelope', () => {
    const harness = runtimeHarness()
    harness.send({
      kind: 'core.request',
      requestId: '018f1f9c-4f5e-8a12-9234-123456789abc',
      operation: 'unknown.read',
      input: undefined
    })
    expect(harness.posts).toContainEqual({
      kind: 'core.result',
      requestId: '018f1f9c-4f5e-8a12-9234-123456789abc',
      ok: false,
      error: { code: 'validation_failed', retryable: false }
    })
  })
})

function runtimeHarness() {
  let listener: ((event: { data: unknown }) => void) | undefined
  const posts: unknown[] = []
  const afterOperation = vi.fn()
  startUtilityDispatcher({
    parentPort: {
      on(_event, value) {
        listener = value
      },
      postMessage(message) {
        posts.push(message)
      }
    },
    handlers: {} as CoreHandlers,
    counters: {
      messagesReceived: 0,
      requestsCompleted: 0,
      eventsPublished: 0,
      scheduledWakeups: 0
    },
    activeDomainTimers: () => 0,
    afterOperation
  })
  return {
    posts,
    afterOperation,
    send(data: unknown) {
      if (!listener) throw new Error('dispatcher did not subscribe')
      listener({ data })
    }
  }
}
