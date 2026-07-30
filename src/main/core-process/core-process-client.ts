import { randomUUID } from 'node:crypto'
import { utilityProcess, type UtilityProcess } from 'electron'
import { z } from 'zod'
import {
  coreReadySchema,
  coreResponseSchema,
  freezeCampaignSnapshot,
  type CampaignSnapshot,
  type CoreRequest
} from '../../shared/contracts/campaign.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

export class CoreProcessClient {
  readonly #process: UtilityProcess
  readonly #ready: Promise<void>
  #resolveReady: (() => void) | undefined
  #rejectReady: ((error: Error) => void) | undefined
  #closed = false
  #lastSnapshot: CampaignSnapshot = freezeCampaignSnapshot({
    activeCampaignId: null,
    campaigns: []
  })
  readonly #pending = new Map<
    string,
    {
      resolve: (value: CampaignSnapshot) => void
      reject: (error: Error) => void
    }
  >()

  public constructor(dataRoot: string, utilityPath: string) {
    this.#process = utilityProcess.fork(utilityPath, [dataRoot], {
      stdio: 'ignore'
    })
    this.#ready = new Promise<void>((resolve, reject) => {
      this.#resolveReady = resolve
      this.#rejectReady = reject
    })
    this.#process.on('message', (raw) => this.handleMessage(raw))
    this.#process.on('exit', () => {
      const error = new CapabilityError('core_unavailable', true)
      if (!this.#closed) console.error(error.message)
      this.fail(error)
    })
  }

  public async waitUntilReady(): Promise<void> {
    await this.withTimeout(this.#ready)
  }

  public list(): Promise<CampaignSnapshot> {
    if (this.#closed) return Promise.resolve(this.#lastSnapshot)
    return this.request({ kind: 'campaign.list' })
  }

  public create(name: string): Promise<CampaignSnapshot> {
    return this.request({ kind: 'campaign.create', input: { name } })
  }

  public activate(id: string): Promise<CampaignSnapshot> {
    return this.request({ kind: 'campaign.activate', input: { id } })
  }

  public close(): void {
    if (this.#closed) return
    this.#closed = true
    this.rejectAll(new CapabilityError('core_unavailable', false))
    this.#process.postMessage({
      kind: 'core.shutdown',
      requestId: randomUUID()
    })
    setTimeout(() => {
      this.#process.kill()
    }, 1_000).unref()
  }

  private request(request: CoreRequestWithoutId): Promise<CampaignSnapshot> {
    const requestId = randomUUID()
    return this.withTimeout(
      new Promise((resolve, reject) => {
        if (this.#closed) {
          reject(new CapabilityError('core_unavailable', false))
          return
        }
        this.#pending.set(requestId, { resolve, reject })
        this.#process.postMessage({ ...request, requestId })
      })
    )
  }

  private handleMessage(raw: unknown): void {
    if (coreReadySchema.safeParse(raw).success) {
      this.#resolveReady?.()
      this.#resolveReady = undefined
      this.#rejectReady = undefined
      return
    }
    const response = coreResponseSchema.safeParse(raw)
    if (!response.success) {
      const requestId = z.object({ requestId: z.uuid() }).safeParse(raw)
      if (requestId.success) {
        const pending = this.#pending.get(requestId.data.requestId)
        if (pending !== undefined) {
          this.#pending.delete(requestId.data.requestId)
          pending.reject(new CapabilityError('protocol_violation', false))
        }
      }
      return
    }
    const pending = this.#pending.get(response.data.requestId)
    if (pending === undefined) return
    this.#pending.delete(response.data.requestId)
    if (!response.data.ok) {
      pending.reject(
        new CapabilityError(
          response.data.error.code,
          response.data.error.retryable
        )
      )
      return
    }
    const snapshot = freezeCampaignSnapshot(response.data.snapshot)
    this.#lastSnapshot = snapshot
    pending.resolve(snapshot)
  }

  private rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }

  private fail(error: Error): void {
    this.#rejectReady?.(error)
    this.#resolveReady = undefined
    this.#rejectReady = undefined
    this.rejectAll(error)
  }

  private withTimeout<T>(operation: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new CapabilityError('timeout', true)),
        10_000
      )
      operation.then(
        (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
        (error: unknown) => {
          clearTimeout(timeout)
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      )
    })
  }
}

type CoreRequestWithoutId =
  | Omit<Extract<CoreRequest, { kind: 'core.shutdown' }>, 'requestId'>
  | Omit<Extract<CoreRequest, { kind: 'campaign.list' }>, 'requestId'>
  | Omit<Extract<CoreRequest, { kind: 'campaign.create' }>, 'requestId'>
  | Omit<Extract<CoreRequest, { kind: 'campaign.activate' }>, 'requestId'>
