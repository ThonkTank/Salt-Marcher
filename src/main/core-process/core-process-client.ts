import { randomUUID } from 'node:crypto'
import { utilityProcess, type UtilityProcess } from 'electron'
import {
  coreResponseSchema,
  type CampaignSnapshot,
  type CoreRequest
} from '../../shared/contracts/campaign.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

export class CoreProcessClient {
  readonly #process: UtilityProcess
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
    this.#process.on('message', (raw) => this.handleMessage(raw))
    this.#process.on('exit', (code) =>
      this.rejectAll(new CapabilityError(`Core process exited (${code})`))
    )
  }

  public list(): Promise<CampaignSnapshot> {
    return this.request({ kind: 'campaign.list' })
  }

  public create(name: string): Promise<CampaignSnapshot> {
    return this.request({ kind: 'campaign.create', input: { name } })
  }

  public activate(id: string): Promise<CampaignSnapshot> {
    return this.request({ kind: 'campaign.activate', input: { id } })
  }

  public close(): void {
    this.#process.kill()
  }

  private request(request: CoreRequestWithoutId): Promise<CampaignSnapshot> {
    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject })
      this.#process.postMessage({ ...request, requestId })
    })
  }

  private handleMessage(raw: unknown): void {
    const response = coreResponseSchema.safeParse(raw)
    if (!response.success) return
    const pending = this.#pending.get(response.data.requestId)
    if (pending === undefined) return
    this.#pending.delete(response.data.requestId)
    if (!response.data.ok || response.data.snapshot === undefined) {
      pending.reject(
        new CapabilityError(
          response.data.error ?? 'Core process rejected command'
        )
      )
      return
    }
    pending.resolve(response.data.snapshot)
  }

  private rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }
}

type CoreRequestWithoutId =
  | Omit<Extract<CoreRequest, { kind: 'campaign.list' }>, 'requestId'>
  | Omit<Extract<CoreRequest, { kind: 'campaign.create' }>, 'requestId'>
  | Omit<Extract<CoreRequest, { kind: 'campaign.activate' }>, 'requestId'>
