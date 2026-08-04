import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

vi.mock('electron', () => ({
  utilityProcess: { fork: vi.fn() }
}))

import { CoreProcessSupervisor } from '../../src/main/core-process/core-process-supervisor.js'

class FakeUtilityProcess extends EventEmitter {
  readonly stderr = new EventEmitter()
  readonly messages: unknown[] = []
  killed = false

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  kill(): boolean {
    if (this.killed) return false
    this.killed = true
    this.emit('exit', null)
    return true
  }

  ready(): void {
    this.emit('message', { kind: 'core.ready' })
  }

  lastRequest(): { requestId: string; kind: string; input: unknown } {
    return this.messages.at(-1) as {
      requestId: string
      kind: string
      input: unknown
    }
  }

  succeed(payload: unknown): void {
    this.emit('message', {
      requestId: this.lastRequest().requestId,
      ok: true,
      payload
    })
  }
}

function harness() {
  const children: FakeUtilityProcess[] = []
  const supervisor = new CoreProcessSupervisor('/data', '/utility.js', () => {
    const child = new FakeUtilityProcess()
    children.push(child)
    return child as never
  })
  return { supervisor, children }
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(CapabilityError)
    return (error as CapabilityError).code
  }
  throw new Error('Expected operation to fail')
}

describe('CoreProcessSupervisor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('kills a utility that misses the five second ready deadline', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)

    await vi.advanceTimersByTimeAsync(5_000)

    expect(children[0]?.killed).toBe(true)
    expect(supervisor.status()).toBe('recovering')
    await supervisor.closeGracefully()
  })

  it('recovers when the utility exits before ready', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)
    children[0]?.emit('exit', 7)

    expect(supervisor.status()).toBe('recovering')
    await vi.advanceTimersByTimeAsync(100)
    expect(children).toHaveLength(2)
    await supervisor.closeGracefully()
  })

  it('makes an interrupted read retryable', async () => {
    const { supervisor, children } = harness()
    children[0]?.ready()
    const result = supervisor.requestOperation('campaign.list', undefined)
    children[0]?.emit('exit', 1)

    expect(await errorCode(result)).toBe('core_unavailable')
    await supervisor.closeGracefully()
  })

  it('reports outcome_unknown when a sent write exits without a reply', async () => {
    const { supervisor, children } = harness()
    children[0]?.ready()
    const result = supervisor.requestOperation('campaign.create', {
      name: 'Sent write'
    })
    children[0]?.emit('exit', 1)

    expect(await errorCode(result)).toBe('outcome_unknown')
    await supervisor.closeGracefully()
  })

  it('accepts a valid write reply exactly once before a later exit', async () => {
    const { supervisor, children } = harness()
    children[0]?.ready()
    const result = supervisor.requestOperation('campaign.create', {
      name: 'Committed write'
    })
    children[0]?.succeed({
      activeCampaignId: null,
      campaigns: [],
      trashedCampaigns: []
    })
    children[0]?.emit('exit', 1)

    await expect(result).resolves.toEqual({
      activeCampaignId: null,
      campaigns: [],
      trashedCampaigns: []
    })
    await supervisor.closeGracefully()
  })

  it.each([
    ['invalid reply', { nonsense: true }],
    [
      'unknown request id',
      {
        requestId: '55b01e90-fb53-4dc8-9c06-d2969906546a',
        ok: true,
        payload: null
      }
    ]
  ])('kills the utility on %s', async (_label, reply) => {
    const { supervisor, children } = harness()
    children[0]?.ready()
    children[0]?.emit('message', reply)

    expect(children[0]?.killed).toBe(true)
    await supervisor.closeGracefully()
  })

  it('opens the circuit and only restarts after explicit retry', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)
    for (const delay of [100, 500, 2_000]) {
      children.at(-1)?.emit('exit', 1)
      await vi.advanceTimersByTimeAsync(delay)
    }
    children.at(-1)?.emit('exit', 1)
    expect(supervisor.status()).toBe('unavailable')
    const count = children.length

    await vi.advanceTimersByTimeAsync(30_000)
    expect(children).toHaveLength(count)
    supervisor.retry()
    expect(children).toHaveLength(count + 1)
    await supervisor.closeGracefully()
  })
})
