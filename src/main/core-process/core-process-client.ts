import { randomUUID } from 'node:crypto'
import { utilityProcess, type UtilityProcess } from 'electron'
import {
  coreReadySchema,
  coreResponseSchema,
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
  #lastSnapshot: CampaignSnapshot = { activeCampaignId: null, campaigns: [] }
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
    this.#process.on('exit', (code) => {
      const error = new CapabilityError(`Core process exited (${code})`)
      if (!this.#closed) console.error(error.message)
      this.fail(error)
    })
  }

  public async waitUntilReady(): Promise<void> {
    await this.withTimeout(this.#ready, 'Core process did not become ready')
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
    this.rejectAll(new CapabilityError('Core process is closing'))
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
          reject(new CapabilityError('Core process is closed'))
          return
        }
        this.#pending.set(requestId, { resolve, reject })
        this.#process.postMessage({ ...request, requestId })
      }),
      `Core request ${request.kind} timed out`
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
    if (!response.success) return
    const pending = this.#pending.get(response.data.requestId)
    if (pending === undefined) return
    this.#pending.delete(response.data.requestId)
    if (!response.data.ok) {
      pending.reject(
        new CapabilityError(
          response.data.error ?? 'Core process rejected command'
        )
      )
      return
    }
    this.#lastSnapshot = response.data.snapshot
    pending.resolve(response.data.snapshot)
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

  private withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new CapabilityError(message)),
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
