import type { z } from 'zod'
import type { CoreResult } from '../../shared/contracts/core-protocol.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  interruptedOperationError,
  type CoreOperationMode
} from './supervision-policy.js'

interface PendingRequest {
  readonly resolve: (value: unknown) => void
  readonly reject: (error: Error) => void
  readonly schema: z.ZodType<unknown>
  readonly mode: CoreOperationMode
  readonly timer: NodeJS.Timeout
  sent: boolean
}

export type CoreResultDisposition =
  'settled' | 'unknown-request-id' | 'invalid-payload'

export class CoreRequestTracker {
  readonly #pending = new Map<string, PendingRequest>()

  track<T>(
    requestId: string,
    schema: z.ZodType<T>,
    mode: CoreOperationMode,
    deadlineMs: number,
    onTimeout: () => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.#pending.get(requestId)
        if (pending === undefined) return
        this.#pending.delete(requestId)
        pending.reject(interruptedOperationError(pending.mode, 'timeout'))
        onTimeout()
      }, deadlineMs)
      this.#pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        schema,
        mode,
        timer,
        sent: false
      })
    })
  }

  markSent(requestId: string): void {
    const pending = this.#pending.get(requestId)
    if (pending !== undefined) pending.sent = true
  }

  rejectSend(requestId: string): void {
    const pending = this.#take(requestId)
    pending?.reject(new CapabilityError('core_unavailable', true))
  }

  settle(result: CoreResult): CoreResultDisposition {
    if (!result.ok) {
      const pending = this.#take(result.requestId)
      if (pending === undefined) return 'unknown-request-id'
      pending.reject(
        new CapabilityError(
          result.error.code,
          result.error.retryable,
          result.error.issues ?? []
        )
      )
      return 'settled'
    }
    return this.settleValue(result.requestId, result.payload)
  }

  settleValue(requestId: string, payload: unknown): CoreResultDisposition {
    const pending = this.#take(requestId)
    if (pending === undefined) return 'unknown-request-id'
    const value = pending.schema.safeParse(payload)
    if (!value.success) {
      pending.reject(new CapabilityError('protocol_violation', false))
      return 'invalid-payload'
    }
    pending.resolve(value.data)
    return 'settled'
  }

  failAll(readError: Error): void {
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

  #take(requestId: string): PendingRequest | undefined {
    const pending = this.#pending.get(requestId)
    if (pending === undefined) return undefined
    this.#pending.delete(requestId)
    clearTimeout(pending.timer)
    return pending
  }
}
