import { randomUUID } from 'node:crypto'
import { utilityProcess, type UtilityProcess } from 'electron'
import type { z } from 'zod'
import {
  coreControlRequestSchema,
  coreMessageSchema,
  coreRequestSchema,
  coreRuntimeMetricsSchema,
  coreStartupConfigurationSchema,
  type CoreRuntimeMetrics,
  type CoreStartupConfiguration,
  type CoreStartupFailureReason
} from '../../shared/contracts/core-protocol.js'
import type { CoreProcessStatus } from '../../shared/contracts/runtime.js'
import {
  coreOperations,
  type CoreOperationInput,
  type CoreOperationKind,
  type CoreOperationOutput
} from '../../shared/contracts/operations.js'
import type { SessionChangeNotice } from '../../shared/contracts/session-change.js'
import type { ReferenceIndexChangeNotice } from '../../shared/contracts/reference.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { HexChangeNotice } from '../../shared/contracts/hex.js'
import type { WorldLocationChangeNotice } from '../../shared/contracts/world-location.js'
import type { LocationSymbolChangeNotice } from '../../shared/contracts/location-symbol.js'
import type { BiomeChangeNotice } from '../../shared/contracts/biome.js'
import type { EncounterTableChangeNotice } from '../../shared/contracts/encounter-source.js'
import type { LootChangeNotice } from '../../shared/contracts/loot.js'
import type { SessionPreparationChangeNotice } from '../../shared/contracts/session-planner.js'
import { coreRestartDelay } from './supervision-policy.js'
import { CoreEventRouter } from './core-event-router.js'
import { CoreRequestTracker } from './core-request-tracker.js'
import {
  acceptsCoreMessage,
  lifecycleChild,
  publicCoreStatus,
  type CoreLifecycleState,
  type RestartTerminationReason
} from './core-process-lifecycle.js'

const READY_DEADLINE_MS = 10_000
const SHUTDOWN_DEADLINE_MS = 2_000

type ProcessFactory = (path: string, args: readonly string[]) => UtilityProcess

export class CoreProcessSupervisor {
  #lifecycle: CoreLifecycleState = { phase: 'unavailable', generation: 0 }
  readonly #firstReady: Promise<void>
  #resolveFirstReady?: () => void
  #rejectFirstReady?: (error: Error) => void
  #firstReadySettled = false
  #readyTimer: NodeJS.Timeout | undefined
  #restartTimer: NodeJS.Timeout | undefined
  readonly #exitTimes: number[] = []
  readonly #statusListeners = new Set<(status: CoreProcessStatus) => void>()
  readonly #events = new CoreEventRouter()
  readonly #requests = new CoreRequestTracker()
  private readonly startupConfiguration: CoreStartupConfiguration

  constructor(
    startupConfiguration: CoreStartupConfiguration,
    private readonly path: string,
    private readonly processFactory: ProcessFactory = (utilityPath, args) =>
      utilityProcess.fork(utilityPath, [...args], { stdio: 'pipe' })
  ) {
    this.startupConfiguration =
      coreStartupConfigurationSchema.parse(startupConfiguration)
    this.#firstReady = new Promise((resolve, reject) => {
      this.#resolveFirstReady = resolve
      this.#rejectFirstReady = reject
    })
    this.spawn()
  }

  waitUntilReady(): Promise<void> {
    return this.#firstReady
  }

  status(): CoreProcessStatus {
    return publicCoreStatus(this.#lifecycle)
  }

  onStatus(listener: (status: CoreProcessStatus) => void): () => void {
    this.#statusListeners.add(listener)
    listener(this.status())
    return () => this.#statusListeners.delete(listener)
  }

  onSessionChanged(
    listener: (notice: SessionChangeNotice) => void
  ): () => void {
    return this.#events.on('session.changed', listener)
  }

  onReferenceChanged(
    listener: (notice: ReferenceIndexChangeNotice) => void
  ): () => void {
    return this.#events.on('reference.changed', listener)
  }

  onHexChanged(listener: (notice: HexChangeNotice) => void): () => void {
    return this.#events.on('hex.changed', listener)
  }

  onLocationsChanged(
    listener: (notice: WorldLocationChangeNotice) => void
  ): () => void {
    return this.#events.on('locations.changed', listener)
  }

  onLocationSymbolsChanged(
    listener: (notice: LocationSymbolChangeNotice) => void
  ): () => void {
    return this.#events.on('location-symbols.changed', listener)
  }

  onBiomesChanged(listener: (notice: BiomeChangeNotice) => void): () => void {
    return this.#events.on('biomes.changed', listener)
  }

  onEncounterTablesChanged(
    listener: (notice: EncounterTableChangeNotice) => void
  ): () => void {
    return this.#events.on('encounter-tables.changed', listener)
  }

  onLootChanged(listener: (notice: LootChangeNotice) => void): () => void {
    return this.#events.on('loot.changed', listener)
  }

  onPreparationChanged(
    listener: (notice: SessionPreparationChangeNotice) => void
  ): () => void {
    return this.#events.on('session-planner.preparation-changed', listener)
  }

  retry(): void {
    if (this.#lifecycle.phase !== 'unavailable') return
    this.#exitTimes.length = 0
    this.clearRestartTimer()
    this.spawn()
  }

  /** Process-boundary probe registered only by the E2E runtime. */
  terminateUtilityForE2e(): boolean {
    const state = this.#lifecycle
    if (state.phase !== 'starting' && state.phase !== 'ready') return false
    this.beginTermination(state.generation, state.child, 'restart', 'e2e-probe')
    return true
  }

  requestOperation<K extends CoreOperationKind>(
    kind: K,
    input: CoreOperationInput<K>
  ): Promise<CoreOperationOutput<K>> {
    const definition = coreOperations[kind]
    return this.request(
      kind,
      input,
      definition.output as z.ZodType<CoreOperationOutput<K>>,
      definition.deadlineMs,
      false
    )
  }

  /** Internal runtime evidence; never registered as a renderer capability. */
  runtimeMetrics(): Promise<
    Readonly<{
      generation: number
      status: CoreProcessStatus
      utility: CoreRuntimeMetrics
    }>
  > {
    const state = this.#lifecycle
    const child = lifecycleChild(state)
    if (state.phase !== 'ready' || child === undefined)
      return Promise.reject(new CapabilityError('core_unavailable', true))
    const request = coreControlRequestSchema.parse({
      kind: 'core.control',
      requestId: randomUUID(),
      control: 'runtime-metrics'
    })
    const result = this.#requests
      .track(
        request.requestId,
        coreRuntimeMetricsSchema,
        'read',
        READY_DEADLINE_MS,
        () => {
          if (acceptsCoreMessage(this.#lifecycle, state.generation, child))
            this.beginTermination(
              state.generation,
              child,
              'restart',
              'request-timeout'
            )
        }
      )
      .then((utility) => ({
        generation: state.generation,
        status: this.status(),
        utility
      }))
    try {
      child.postMessage(request)
      this.#requests.markSent(request.requestId)
    } catch {
      this.#requests.rejectSend(request.requestId)
      this.beginTermination(state.generation, child, 'restart', 'send-failed')
    }
    return result
  }

  async closeGracefully(): Promise<void> {
    const state = this.#lifecycle
    if (state.phase === 'closed' || state.phase === 'closing') return
    this.clearRestartTimer()
    const child = lifecycleChild(state)
    this.transition({
      phase: 'closing',
      generation: state.generation,
      ...(child === undefined ? {} : { child })
    })
    if (child !== undefined && state.phase === 'ready') {
      try {
        await this.request(
          'core.shutdown',
          undefined,
          coreOperations['core.shutdown'].output,
          SHUTDOWN_DEADLINE_MS,
          true
        )
      } catch {
        // The centralized hard-stop below is the bounded fallback.
      }
    }
    const current = this.#lifecycle
    if (child === undefined || lifecycleChild(current) !== child) {
      this.finishClose()
      return
    }
    this.beginTermination(current.generation, child, 'closed', 'shutdown')
  }

  private request<T>(
    kind: CoreOperationKind,
    input: unknown,
    schema: z.ZodType<T>,
    deadlineMs: number,
    allowWhileClosing: boolean
  ): Promise<T> {
    const request = coreRequestSchema.parse({
      kind: 'core.request',
      requestId: randomUUID(),
      operation: kind,
      input
    })
    const state = this.#lifecycle
    const canRequest =
      state.phase === 'ready' ||
      (allowWhileClosing && state.phase === 'closing')
    const child = lifecycleChild(state)
    if (!canRequest || child === undefined)
      return Promise.reject(
        new CapabilityError(
          'core_unavailable',
          state.phase !== 'closed' && state.phase !== 'terminal'
        )
      )
    const definition = coreOperations[request.operation]
    const result = this.#requests.track(
      request.requestId,
      schema,
      definition.mode,
      deadlineMs,
      () => {
        this.log('request-timeout', {
          operation: request.operation,
          mode: definition.mode,
          generation: state.generation
        })
        if (acceptsCoreMessage(this.#lifecycle, state.generation, child))
          this.beginTermination(
            state.generation,
            child,
            'restart',
            'request-timeout'
          )
      }
    )
    try {
      child.postMessage(request)
      this.#requests.markSent(request.requestId)
    } catch {
      this.#requests.rejectSend(request.requestId)
      this.log('send-failed', {
        operation: request.operation,
        generation: state.generation
      })
      this.beginTermination(state.generation, child, 'restart', 'send-failed')
    }
    return result
  }

  private handle(
    generation: number,
    child: UtilityProcess,
    raw: unknown
  ): void {
    if (!acceptsCoreMessage(this.#lifecycle, generation, child)) return
    const message = coreMessageSchema.safeParse(raw)
    if (!message.success)
      return this.protocol(generation, child, 'invalid-reply')
    switch (message.data.kind) {
      case 'core.ready': {
        if (this.#lifecycle.phase !== 'starting')
          return this.protocol(generation, child, 'duplicate-ready')
        this.clearReadyTimer()
        this.transition({ phase: 'ready', generation, child })
        this.resolveFirstReady()
        this.log('ready', { generation })
        return
      }
      case 'core.startup-failed': {
        this.clearReadyTimer()
        this.#requests.failAll(new CapabilityError('core_unavailable', false))
        this.log('startup-failed', {
          generation,
          reason: message.data.reason,
          retryable: message.data.retryable
        })
        if (message.data.reason === 'internal')
          this.beginTermination(
            generation,
            child,
            'restart',
            message.data.reason
          )
        else {
          this.rejectFirstReady(false)
          this.beginTermination(
            generation,
            child,
            'terminal',
            message.data.reason
          )
        }
        return
      }
      case 'core.result': {
        const disposition = this.#requests.settle(message.data)
        if (disposition !== 'settled')
          this.protocol(generation, child, disposition)
        return
      }
      case 'core.diagnostics': {
        const disposition = this.#requests.settleValue(
          message.data.requestId,
          message.data.metrics
        )
        if (disposition !== 'settled')
          this.protocol(generation, child, disposition)
        return
      }
      default:
        this.#events.dispatch(message.data)
    }
  }

  private protocol(
    generation: number,
    child: UtilityProcess,
    cause: string
  ): void {
    this.log('protocol-violation', { cause, generation })
    this.#requests.failAll(new CapabilityError('protocol_violation', false))
    this.beginTermination(generation, child, 'restart', 'protocol-violation')
  }

  private beginTermination(
    generation: number,
    child: UtilityProcess,
    disposition: 'restart' | 'terminal' | 'closed',
    reason: RestartTerminationReason | CoreStartupFailureReason | 'shutdown'
  ): void {
    const state = this.#lifecycle
    if (state.generation !== generation || lifecycleChild(state) !== child)
      return
    if (state.phase === 'terminating') {
      if (disposition === 'closed' && state.disposition !== 'closed')
        this.transition({ ...state, disposition: 'closed', reason: 'shutdown' })
      return
    }
    this.transition({
      phase: 'terminating',
      generation,
      child,
      disposition,
      reason
    })
    child.kill()
  }

  private spawn(): void {
    const state = this.#lifecycle
    if (
      (state.phase !== 'unavailable' && state.phase !== 'backing-off') ||
      this.#restartTimer !== undefined
    )
      return
    const generation = state.generation + 1
    let child: UtilityProcess
    try {
      child = this.processFactory(this.path, [
        JSON.stringify(this.startupConfiguration)
      ])
    } catch (error) {
      this.log('spawn-failed', {
        generation,
        errorName: error instanceof Error ? error.name : 'Error'
      })
      this.scheduleRestart(generation)
      return
    }
    this.transition({ phase: 'starting', generation, child })
    this.#readyTimer = setTimeout(() => {
      if (!acceptsCoreMessage(this.#lifecycle, generation, child)) return
      this.log('ready-timeout', { deadlineMs: READY_DEADLINE_MS, generation })
      this.beginTermination(generation, child, 'restart', 'ready-timeout')
    }, READY_DEADLINE_MS)
    child.stderr?.on('data', (chunk: Buffer | string) => {
      if (!acceptsCoreMessage(this.#lifecycle, generation, child)) return
      const diagnostic = String(chunk)
        .replaceAll(this.startupConfiguration.dataRoot, '<data-root>')
        .trim()
        .slice(0, 2_000)
      this.log('stderr', {
        generation,
        bytes: Buffer.byteLength(chunk),
        ...(diagnostic ? { diagnostic } : {})
      })
    })
    child.on('message', (value) => this.handle(generation, child, value))
    child.on('exit', (code) => this.exited(generation, child, code))
    this.log('spawned', { generation })
  }

  private exited(
    generation: number,
    child: UtilityProcess,
    code: number | null
  ): void {
    const state = this.#lifecycle
    if (state.generation !== generation || lifecycleChild(state) !== child)
      return
    this.clearReadyTimer()
    this.#requests.failAll(new CapabilityError('core_unavailable', true))
    this.log('exited', { code, generation })
    if (state.phase === 'closing') {
      this.finishClose()
      return
    }
    if (state.phase === 'terminating') {
      if (state.disposition === 'closed') {
        this.finishClose()
        return
      }
      if (state.disposition === 'terminal') {
        this.transition({
          phase: 'terminal',
          generation,
          reason: state.reason as Exclude<CoreStartupFailureReason, 'internal'>
        })
        return
      }
    }
    this.scheduleRestart(generation)
  }

  private scheduleRestart(generation: number): void {
    const now = Date.now()
    this.#exitTimes.push(now)
    while ((this.#exitTimes[0] ?? now) < now - 30_000) this.#exitTimes.shift()
    const delay = coreRestartDelay(this.#exitTimes.length)
    if (delay === null) {
      this.transition({ phase: 'unavailable', generation })
      this.rejectFirstReady(true)
      return
    }
    this.transition({
      phase: 'backing-off',
      generation,
      attempt: this.#exitTimes.length
    })
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = undefined
      this.spawn()
    }, delay)
  }

  private finishClose(): void {
    if (this.#lifecycle.phase === 'closed') return
    const generation = this.#lifecycle.generation
    this.clearReadyTimer()
    this.clearRestartTimer()
    this.#requests.failAll(new CapabilityError('core_unavailable', false))
    this.rejectFirstReady(false)
    this.transition({ phase: 'closed', generation })
    this.log('closed', { generation })
  }

  private resolveFirstReady(): void {
    if (this.#firstReadySettled) return
    this.#firstReadySettled = true
    this.#resolveFirstReady?.()
  }

  private rejectFirstReady(retryable: boolean): void {
    if (this.#firstReadySettled) return
    this.#firstReadySettled = true
    this.#rejectFirstReady?.(new CapabilityError('core_unavailable', retryable))
  }

  private transition(next: CoreLifecycleState): void {
    const previousStatus = this.status()
    this.#lifecycle = next
    const nextStatus = this.status()
    if (nextStatus === previousStatus) return
    for (const listener of this.#statusListeners) listener(nextStatus)
  }

  private clearReadyTimer(): void {
    if (this.#readyTimer !== undefined) clearTimeout(this.#readyTimer)
    this.#readyTimer = undefined
  }

  private clearRestartTimer(): void {
    if (this.#restartTimer !== undefined) clearTimeout(this.#restartTimer)
    this.#restartTimer = undefined
  }

  private log(event: string, details: Record<string, unknown> = {}): void {
    console.info(
      JSON.stringify({
        component: 'core-process-supervisor',
        event,
        status: this.status(),
        phase: this.#lifecycle.phase,
        ...details
      })
    )
  }
}
