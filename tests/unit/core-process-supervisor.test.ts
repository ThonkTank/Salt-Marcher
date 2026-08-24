import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

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

  lastRequest(): {
    kind: 'core.request'
    requestId: string
    operation: string
    input: unknown
  } {
    return this.messages.at(-1) as {
      kind: 'core.request'
      requestId: string
      operation: string
      input: unknown
    }
  }

  succeed(payload: unknown): void {
    this.emit('message', {
      kind: 'core.result',
      requestId: this.lastRequest().requestId,
      ok: true,
      payload
    })
  }

  diagnostics(): void {
    const control = this.messages.at(-1) as { requestId: string }
    this.emit('message', {
      kind: 'core.diagnostics',
      requestId: control.requestId,
      metrics: {
        messagesReceived: 1,
        requestsCompleted: 0,
        eventsPublished: 0,
        scheduledWakeups: 0,
        activeDomainTimers: 0,
        uptimeMs: 25,
        bootstrap: { totalMs: 20, phases: { configuration: 1 } }
      }
    })
  }
}

function harness() {
  const children: FakeUtilityProcess[] = []
  const spawnArguments: string[][] = []
  const supervisor = new CoreProcessSupervisor(
    {
      dataRoot: '/data',
      referenceDatabasePath: '/reference.sqlite',
      sessionGenerationCatalogRoot: '/sessiongeneration',
      incompatibleDataPolicy: 'reset'
    },
    '/utility.js',
    (_path, arguments_) => {
      const child = new FakeUtilityProcess()
      children.push(child)
      spawnArguments.push([...arguments_])
      return child as never
    }
  )
  return { supervisor, children, spawnArguments }
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

  it('starts every generation with one validated configuration envelope', async () => {
    const { supervisor, spawnArguments } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)
    expect(spawnArguments).toEqual([
      [
        JSON.stringify({
          dataRoot: '/data',
          referenceDatabasePath: '/reference.sqlite',
          sessionGenerationCatalogRoot: '/sessiongeneration',
          incompatibleDataPolicy: 'reset'
        })
      ]
    ])
    await supervisor.closeGracefully()
  })

  it('allows a utility up to the ten second ready deadline', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)

    await vi.advanceTimersByTimeAsync(9_999)

    expect(children[0]?.killed).toBe(false)
    children[0]?.ready()
    await expect(supervisor.waitUntilReady()).resolves.toBeUndefined()
    children[0]?.emit('exit', 0)
    await supervisor.closeGracefully()
  })

  it('reports generation-bound internal runtime evidence', async () => {
    const { supervisor, children } = harness()
    children[0]?.ready()

    const evidence = supervisor.runtimeMetrics()
    expect(children[0]?.messages.at(-1)).toMatchObject({
      kind: 'core.control',
      control: 'runtime-metrics'
    })
    children[0]?.diagnostics()

    await expect(evidence).resolves.toMatchObject({
      generation: 1,
      status: 'ready',
      utility: {
        scheduledWakeups: 0,
        activeDomainTimers: 0,
        bootstrap: { totalMs: 20 }
      }
    })
    children[0]?.emit('exit', 0)
    await supervisor.closeGracefully()
  })

  it('kills a utility that misses the ten second ready deadline', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)

    await vi.advanceTimersByTimeAsync(10_000)

    expect(children[0]?.killed).toBe(true)
    expect(supervisor.status()).toBe('recovering')
    await supervisor.closeGracefully()
  })

  it('ignores a late ready message after termination begins', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)

    await vi.advanceTimersByTimeAsync(10_000)
    children[0]?.ready()

    expect(supervisor.status()).toBe('recovering')
    await vi.advanceTimersByTimeAsync(999)
    expect(children).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(children).toHaveLength(2)
    await supervisor.closeGracefully()
  })

  it('recovers when the utility exits before ready', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)
    children[0]?.emit('exit', 7)

    expect(supervisor.status()).toBe('recovering')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(children).toHaveLength(2)
    await supervisor.closeGracefully()
  })

  it('treats incompatible data as terminal and never restarts', async () => {
    const { supervisor, children } = harness()
    const firstReady = supervisor.waitUntilReady()
    children[0]?.emit('message', {
      kind: 'core.startup-failed',
      reason: 'incompatible-data',
      retryable: false
    })

    expect(await errorCode(firstReady)).toBe('core_unavailable')
    expect(children[0]?.killed).toBe(true)
    expect(supervisor.status()).toBe('incompatible-data')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(children).toHaveLength(1)
    supervisor.retry()
    expect(children).toHaveLength(1)
    await supervisor.closeGracefully()
  })

  it.each([
    ['corrupt-data', 'corrupt-data'],
    ['access-denied', 'access-denied'],
    ['resource-missing', 'resource-missing'],
    ['invalid-configuration', 'invalid-configuration']
  ] as const)('surfaces terminal startup reason %s', async (reason, status) => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)
    children[0]?.emit('message', {
      kind: 'core.startup-failed',
      reason,
      retryable: false
    })

    expect(supervisor.status()).toBe(status)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(children).toHaveLength(1)
    await supervisor.closeGracefully()
  })

  it('restarts an unexpected internal startup failure with backoff', async () => {
    const { supervisor, children } = harness()
    void supervisor.waitUntilReady().catch(() => undefined)
    children[0]?.emit('message', {
      kind: 'core.startup-failed',
      reason: 'internal',
      retryable: true
    })

    expect(supervisor.status()).toBe('recovering')
    await vi.advanceTimersByTimeAsync(1_000)
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

  it('interrupts one committed write reply through the E2E-only probe', async () => {
    const { supervisor, children } = harness()
    children[0]?.ready()
    expect(
      supervisor.interruptNextResultForE2e('generatorPresets.create')
    ).toBe(true)
    expect(
      supervisor.interruptNextResultForE2e('generatorPresets.create')
    ).toBe(false)
    const result = supervisor.requestOperation('generatorPresets.create', {
      commandId: '00000000-0000-4000-8000-000000000001',
      expectedRegistryRevision: 0,
      name: 'Committed preset',
      config: defaultGeneratorConfig
    })
    children[0]?.succeed({
      kind: 'created',
      commandId: '00000000-0000-4000-8000-000000000001',
      registry: { revision: 1, presets: [] },
      saved: {}
    })

    expect(await errorCode(result)).toBe('outcome_unknown')
    expect(children[0]?.killed).toBe(true)
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

  it('forwards typed campaign reference invalidations', async () => {
    const { supervisor, children } = harness()
    const listener = vi.fn()
    supervisor.onReferenceChanged(listener)
    children[0]?.ready()
    children[0]?.emit('message', {
      kind: 'reference.changed',
      notice: {
        campaignId: 'campaign-a',
        revision: 'campaign-a:2:3',
        changedTargets: []
      }
    })

    expect(listener).toHaveBeenCalledWith({
      campaignId: 'campaign-a',
      revision: 'campaign-a:2:3',
      changedTargets: []
    })
    children[0]?.emit('exit', 0)
    await supervisor.closeGracefully()
  })

  it('forwards revisioned biome and encounter-table invalidations', async () => {
    const { supervisor, children } = harness()
    const biomeListener = vi.fn()
    const tableListener = vi.fn()
    supervisor.onBiomesChanged(biomeListener)
    supervisor.onEncounterTablesChanged(tableListener)
    children[0]?.ready()
    children[0]?.emit('message', {
      kind: 'biomes.changed',
      notice: {
        revision: 4,
        changedBiomeIds: ['forest'],
        reason: 'updated'
      }
    })
    children[0]?.emit('message', {
      kind: 'encounter-tables.changed',
      notice: {
        installationRevision: 3,
        campaignRevision: 7,
        changedTableIds: ['00000000-0000-4000-8000-000000000001'],
        scope: 'installation',
        reason: 'deleted'
      }
    })

    expect(biomeListener).toHaveBeenCalledWith({
      revision: 4,
      changedBiomeIds: ['forest'],
      reason: 'updated'
    })
    expect(tableListener).toHaveBeenCalledWith({
      installationRevision: 3,
      campaignRevision: 7,
      changedTableIds: ['00000000-0000-4000-8000-000000000001'],
      scope: 'installation',
      reason: 'deleted'
    })
    children[0]?.emit('exit', 0)
    await supervisor.closeGracefully()
  })

  it.each([
    ['invalid reply', { nonsense: true }],
    [
      'unknown request id',
      {
        kind: 'core.result',
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
    for (const delay of [1_000, 5_000, 15_000]) {
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
