import { randomUUID } from 'node:crypto'
import { utilityProcess, type UtilityProcess } from 'electron'
import { z } from 'zod'
import { coreReadySchema } from '../../shared/contracts/campaign.js'
import {
  coreEventSchema,
  coreRequestSchema,
  coreResultSchema
} from '../../shared/contracts/core-protocol.js'
import {
  coreOperations,
  type CoreOperationInput,
  type CoreOperationKind,
  type CoreOperationOutput
} from '../../shared/contracts/operations.js'
import {
  sessionChangeNoticeSchema,
  type SessionChangeNotice
} from '../../shared/contracts/session-change.js'
import {
  referenceIndexChangeNoticeSchema,
  type ReferenceIndexChangeNotice
} from '../../shared/contracts/reference.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  hexChangeNoticeSchema,
  type HexChangeNotice
} from '../../shared/contracts/hex.js'
import {
  worldLocationChangeNoticeSchema,
  type WorldLocationChangeNotice
} from '../../shared/contracts/world-location.js'
import {
  locationSymbolChangeNoticeSchema,
  type LocationSymbolChangeNotice
} from '../../shared/contracts/location-symbol.js'
import {
  biomeChangeNoticeSchema,
  type BiomeChangeNotice
} from '../../shared/contracts/biome.js'
import {
  encounterTableChangeNoticeSchema,
  type EncounterTableChangeNotice
} from '../../shared/contracts/encounter-source.js'
import {
  lootChangeNoticeSchema,
  type LootChangeNotice
} from '../../shared/contracts/loot.js'
import {
  sessionPreparationChangeNoticeSchema,
  type SessionPreparationChangeNotice
} from '../../shared/contracts/session-planner.js'
import {
  coreRestartDelay,
  interruptedOperationError,
  type CoreOperationMode
} from './supervision-policy.js'

const READY_DEADLINE_MS = 5_000
const SHUTDOWN_DEADLINE_MS = 2_000

type ProcessFactory = (path: string, args: readonly string[]) => UtilityProcess

interface PendingRequest {
  readonly resolve: (value: unknown) => void
  readonly reject: (error: Error) => void
  readonly schema: z.ZodType<unknown>
  readonly mode: CoreOperationMode
  readonly timer: NodeJS.Timeout
  sent: boolean
}

export class CoreProcessSupervisor {
  #process: UtilityProcess | undefined
  readonly #firstReady: Promise<void>
  #resolveFirstReady?: () => void
  #rejectFirstReady?: (error: Error) => void
  #firstReadyResolved = false
  #closed = false
  #closing = false
  #readyTimer: NodeJS.Timeout | undefined
  #restartTimer: NodeJS.Timeout | undefined
  readonly #exitTimes: number[] = []
  #status: CoreProcessStatus = 'starting'
  readonly #statusListeners = new Set<(status: CoreProcessStatus) => void>()
  readonly #sessionChangeListeners = new Set<
    (notice: SessionChangeNotice) => void
  >()
  readonly #referenceChangeListeners = new Set<
    (notice: ReferenceIndexChangeNotice) => void
  >()
  readonly #hexChangeListeners = new Set<(notice: HexChangeNotice) => void>()
  readonly #locationChangeListeners = new Set<
    (notice: WorldLocationChangeNotice) => void
  >()
  readonly #locationSymbolChangeListeners = new Set<
    (notice: LocationSymbolChangeNotice) => void
  >()
  readonly #biomeChangeListeners = new Set<
    (notice: BiomeChangeNotice) => void
  >()
  readonly #encounterTableChangeListeners = new Set<
    (notice: EncounterTableChangeNotice) => void
  >()
  readonly #lootChangeListeners = new Set<(notice: LootChangeNotice) => void>()
  readonly #preparationChangeListeners = new Set<
    (notice: SessionPreparationChangeNotice) => void
  >()
  readonly #pending = new Map<string, PendingRequest>()

  constructor(
    private readonly dataRoot: string,
    private readonly path: string,
    private readonly referenceDatabasePath: string,
    private readonly sessionGenerationCatalogRoot: string,
    private readonly processFactory: ProcessFactory = (utilityPath, args) =>
      utilityProcess.fork(utilityPath, [...args], { stdio: 'pipe' })
  ) {
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
    return this.#status
  }

  onStatus(listener: (status: CoreProcessStatus) => void): () => void {
    this.#statusListeners.add(listener)
    listener(this.#status)
    return () => this.#statusListeners.delete(listener)
  }

  onSessionChanged(
    listener: (notice: SessionChangeNotice) => void
  ): () => void {
    this.#sessionChangeListeners.add(listener)
    return () => this.#sessionChangeListeners.delete(listener)
  }

  onReferenceChanged(
    listener: (notice: ReferenceIndexChangeNotice) => void
  ): () => void {
    this.#referenceChangeListeners.add(listener)
    return () => this.#referenceChangeListeners.delete(listener)
  }

  onHexChanged(listener: (notice: HexChangeNotice) => void): () => void {
    this.#hexChangeListeners.add(listener)
    return () => this.#hexChangeListeners.delete(listener)
  }

  onLocationsChanged(
    listener: (notice: WorldLocationChangeNotice) => void
  ): () => void {
    this.#locationChangeListeners.add(listener)
    return () => this.#locationChangeListeners.delete(listener)
  }

  onLocationSymbolsChanged(
    listener: (notice: LocationSymbolChangeNotice) => void
  ): () => void {
    this.#locationSymbolChangeListeners.add(listener)
    return () => this.#locationSymbolChangeListeners.delete(listener)
  }

  onBiomesChanged(listener: (notice: BiomeChangeNotice) => void): () => void {
    this.#biomeChangeListeners.add(listener)
    return () => this.#biomeChangeListeners.delete(listener)
  }

  onEncounterTablesChanged(
    listener: (notice: EncounterTableChangeNotice) => void
  ): () => void {
    this.#encounterTableChangeListeners.add(listener)
    return () => this.#encounterTableChangeListeners.delete(listener)
  }

  onLootChanged(listener: (notice: LootChangeNotice) => void): () => void {
    this.#lootChangeListeners.add(listener)
    return () => this.#lootChangeListeners.delete(listener)
  }

  onPreparationChanged(
    listener: (notice: SessionPreparationChangeNotice) => void
  ): () => void {
    this.#preparationChangeListeners.add(listener)
    return () => this.#preparationChangeListeners.delete(listener)
  }

  retry(): void {
    if (this.#closed || this.#closing) return
    this.#exitTimes.length = 0
    this.clearRestartTimer()
    this.setStatus('recovering')
    this.spawn()
  }

  /** Process-boundary probe registered only by the E2E runtime. It deliberately
   * follows the normal crash/restart path instead of bypassing supervision. */
  terminateUtilityForE2e(): boolean {
    if (this.#closed || this.#closing || this.#process === undefined)
      return false
    this.#process.kill()
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

  async closeGracefully(): Promise<void> {
    if (this.#closed || this.#closing) return
    this.#closing = true
    this.clearRestartTimer()
    const child = this.#process
    if (child !== undefined && this.#status === 'ready') {
      try {
        await this.request(
          'core.shutdown',
          undefined,
          coreOperations['core.shutdown'].output,
          SHUTDOWN_DEADLINE_MS,
          true
        )
      } catch {
        // The hard-stop below is the bounded fallback.
      }
    }
    if (this.#process === child && child !== undefined) child.kill()
    this.finishClose()
  }

  private request<T>(
    kind: CoreOperationKind,
    input: unknown,
    schema: z.ZodType<T>,
    deadlineMs: number,
    allowWhileClosing: boolean
  ): Promise<T> {
    const request = coreRequestSchema.parse({
      requestId: randomUUID(),
      kind,
      input
    })
    return new Promise((resolve, reject) => {
      const child = this.#process
      if (
        this.#closed ||
        (!allowWhileClosing && this.#closing) ||
        child === undefined ||
        this.#status !== 'ready'
      ) {
        reject(new CapabilityError('core_unavailable', !this.#closed))
        return
      }
      const definition = coreOperations[request.kind]
      const timer = setTimeout(() => {
        const pending = this.#pending.get(request.requestId)
        if (pending === undefined) return
        this.#pending.delete(request.requestId)
        pending.reject(interruptedOperationError(pending.mode, 'timeout'))
        this.log('request-timeout', {
          operation: request.kind,
          mode: pending.mode
        })
        if (this.#process === child) child.kill()
      }, deadlineMs)
      const pending: PendingRequest = {
        resolve: resolve as (value: unknown) => void,
        reject,
        schema,
        mode: definition.mode,
        timer,
        sent: false
      }
      this.#pending.set(request.requestId, pending)
      try {
        child.postMessage(request)
        pending.sent = true
      } catch {
        clearTimeout(timer)
        this.#pending.delete(request.requestId)
        reject(new CapabilityError('core_unavailable', true))
        this.log('send-failed', { operation: request.kind })
        child.kill()
      }
    })
  }

  private handle(raw: unknown): void {
    if (coreReadySchema.safeParse(raw).success) {
      if (this.#status === 'ready') return this.protocol('duplicate-ready')
      this.clearReadyTimer()
      this.setStatus('ready')
      if (!this.#firstReadyResolved) {
        this.#firstReadyResolved = true
        this.#resolveFirstReady?.()
      }
      this.log('ready')
      return
    }
    const event = coreEventSchema.safeParse(raw)
    if (event.success) {
      switch (event.data.kind) {
        case 'session.changed': {
          const notice = sessionChangeNoticeSchema.parse(event.data.notice)
          for (const listener of this.#sessionChangeListeners) listener(notice)
          break
        }
        case 'loot.changed': {
          const notice = lootChangeNoticeSchema.parse(event.data.notice)
          for (const listener of this.#lootChangeListeners) listener(notice)
          break
        }
        case 'session-planner.preparation-changed': {
          const notice = sessionPreparationChangeNoticeSchema.parse(
            event.data.notice
          )
          for (const listener of this.#preparationChangeListeners)
            listener(notice)
          break
        }
        case 'reference.changed': {
          const notice = referenceIndexChangeNoticeSchema.parse(
            event.data.notice
          )
          for (const listener of this.#referenceChangeListeners)
            listener(notice)
          break
        }
        case 'hex.changed': {
          const notice = hexChangeNoticeSchema.parse(event.data.notice)
          for (const listener of this.#hexChangeListeners) listener(notice)
          break
        }
        case 'locations.changed': {
          const notice = worldLocationChangeNoticeSchema.parse(
            event.data.notice
          )
          for (const listener of this.#locationChangeListeners) listener(notice)
          break
        }
        case 'location-symbols.changed': {
          const notice = locationSymbolChangeNoticeSchema.parse(
            event.data.notice
          )
          for (const listener of this.#locationSymbolChangeListeners)
            listener(notice)
          break
        }
        case 'biomes.changed': {
          const notice = biomeChangeNoticeSchema.parse(event.data.notice)
          for (const listener of this.#biomeChangeListeners) listener(notice)
          break
        }
        case 'encounter-tables.changed': {
          const notice = encounterTableChangeNoticeSchema.parse(
            event.data.notice
          )
          for (const listener of this.#encounterTableChangeListeners)
            listener(notice)
          break
        }
      }
      return
    }
    const result = coreResultSchema.safeParse(raw)
    if (!result.success) return this.protocol('invalid-reply')
    const pending = this.#pending.get(result.data.requestId)
    if (pending === undefined) return this.protocol('unknown-request-id')
    this.#pending.delete(result.data.requestId)
    clearTimeout(pending.timer)
    if (!result.data.ok) {
      pending.reject(
        new CapabilityError(
          result.data.error.code,
          result.data.error.retryable,
          result.data.error.issues ?? []
        )
      )
      return
    }
    const value = pending.schema.safeParse(result.data.payload)
    if (!value.success) {
      pending.reject(new CapabilityError('protocol_violation', false))
      return this.protocol('invalid-payload')
    }
    pending.resolve(value.data)
  }

  private protocol(cause: string): void {
    this.log('protocol-violation', { cause })
    this.failPending(new CapabilityError('protocol_violation', false))
    this.#process?.kill()
  }

  private failPending(readError: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(
        pending.mode === 'write' && pending.sent
          ? new CapabilityError('outcome_unknown', false)
          : readError
      )
    }
    this.#pending.clear()
  }

  private spawn(): void {
    if (
      this.#closed ||
      this.#closing ||
      this.#process !== undefined ||
      this.#restartTimer !== undefined
    )
      return
    this.setStatus(this.#firstReadyResolved ? 'recovering' : 'starting')
    const child = this.processFactory(this.path, [
      this.dataRoot,
      this.referenceDatabasePath,
      this.sessionGenerationCatalogRoot
    ])
    this.#process = child
    this.#readyTimer = setTimeout(() => {
      if (this.#process !== child || this.#status === 'ready') return
      this.log('ready-timeout', { deadlineMs: READY_DEADLINE_MS })
      child.kill()
    }, READY_DEADLINE_MS)
    child.stderr?.on('data', (chunk: Buffer | string) => {
      const diagnostic = String(chunk)
        .replaceAll(this.dataRoot, '<development-data>')
        .trim()
        .slice(0, 2_000)
      this.log('stderr', {
        bytes: Buffer.byteLength(chunk),
        ...(diagnostic ? { diagnostic } : {})
      })
    })
    child.on('message', (value) => this.handle(value))
    child.on('exit', (code) => this.exited(child, code))
    this.log('spawned')
  }

  private exited(child: UtilityProcess, code: number | null): void {
    if (this.#process !== child) return
    this.clearReadyTimer()
    this.#process = undefined
    this.failPending(new CapabilityError('core_unavailable', true))
    this.log('exited', { code })
    if (this.#closed || this.#closing) {
      this.finishClose()
      return
    }
    const now = Date.now()
    this.#exitTimes.push(now)
    while ((this.#exitTimes[0] ?? now) < now - 30_000) this.#exitTimes.shift()
    const delay = coreRestartDelay(this.#exitTimes.length)
    if (delay === null) {
      this.setStatus('unavailable')
      if (!this.#firstReadyResolved)
        this.#rejectFirstReady?.(new CapabilityError('core_unavailable', true))
      return
    }
    this.setStatus('recovering')
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = undefined
      this.spawn()
    }, delay)
  }

  private finishClose(): void {
    if (this.#closed) return
    this.#closed = true
    this.#closing = false
    this.clearReadyTimer()
    this.clearRestartTimer()
    this.failPending(new CapabilityError('core_unavailable', false))
    this.#process = undefined
    this.setStatus('closed')
    this.log('closed')
  }

  private clearReadyTimer(): void {
    if (this.#readyTimer !== undefined) clearTimeout(this.#readyTimer)
    this.#readyTimer = undefined
  }

  private clearRestartTimer(): void {
    if (this.#restartTimer !== undefined) clearTimeout(this.#restartTimer)
    this.#restartTimer = undefined
  }

  private setStatus(status: CoreProcessStatus): void {
    if (this.#status === status) return
    this.#status = status
    for (const listener of this.#statusListeners) listener(status)
  }

  private log(event: string, details: Record<string, unknown> = {}): void {
    console.info(
      JSON.stringify({
        component: 'core-process-supervisor',
        event,
        status: this.#status,
        ...details
      })
    )
  }
}

export type CoreProcessStatus =
  'starting' | 'ready' | 'recovering' | 'unavailable' | 'closed'
