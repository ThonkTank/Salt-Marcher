import { z } from 'zod'
import {
  capabilityFailureSchema,
  type CapabilityErrorCode
} from '../shared/contracts/campaign.js'
import {
  coreControlRequestSchema,
  coreDiagnosticsSchema,
  coreRequestSchema,
  type CoreHandlers,
  type CoreRequest
} from '../shared/contracts/core-protocol.js'
import { coreOperations } from '../shared/contracts/operations.js'
import { CapabilityError } from '../shared/errors/capability-error.js'
import { bootstrapMetrics } from './bootstrap-observability.js'

export interface UtilityRuntimeCounters {
  messagesReceived: number
  requestsCompleted: number
  eventsPublished: number
  scheduledWakeups: number
}

interface UtilityParentPort {
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown
  postMessage(message: unknown): void
}

interface UtilityDispatcherOptions {
  parentPort: UtilityParentPort
  handlers: CoreHandlers
  counters: UtilityRuntimeCounters
  activeDomainTimers: () => number
  afterOperation: (request: CoreRequest, payload: unknown) => void
}

/** Owns protocol parsing, diagnostics, dispatch, and response envelopes. */
export function startUtilityDispatcher(
  options: UtilityDispatcherOptions
): void {
  options.parentPort.on('message', (event) => {
    void handleMessage(options, event)
  })
}

async function handleMessage(
  options: UtilityDispatcherOptions,
  event: { data: unknown }
): Promise<void> {
  options.counters.messagesReceived += 1
  const control = coreControlRequestSchema.safeParse(event.data)
  if (control.success) {
    options.parentPort.postMessage(
      coreDiagnosticsSchema.parse({
        kind: 'core.diagnostics',
        requestId: control.data.requestId,
        metrics: {
          ...options.counters,
          activeDomainTimers: options.activeDomainTimers(),
          uptimeMs: process.uptime() * 1_000,
          bootstrap: bootstrapMetrics()
        }
      })
    )
    return
  }
  const parsed = coreRequestSchema.safeParse(event.data)
  if (!parsed.success) {
    const envelope = z
      .object({
        kind: z.literal('core.request'),
        requestId: z.uuid(),
        operation: z.string()
      })
      .safeParse(event.data)
    if (envelope.success)
      failure(options, envelope.data.requestId, 'validation_failed')
    return
  }
  const request = parsed.data
  try {
    const payload = await dispatch(options.handlers, request)
    options.afterOperation(request, payload)
    respond(options, request.requestId, payload)
    if (request.operation === 'core.shutdown')
      setImmediate(() => process.exit(0))
  } catch (error) {
    const mapped = capabilityFailure(error)
    failure(
      options,
      request.requestId,
      mapped.code,
      mapped.retryable,
      mapped.issues
    )
  } finally {
    options.counters.requestsCompleted += 1
  }
}

function dispatch(
  handlers: CoreHandlers,
  request: CoreRequest
): Promise<unknown> {
  const handler = handlers[request.operation] as (input: unknown) => unknown
  return Promise.resolve(handler(request.input)).then((payload) =>
    coreOperations[request.operation].output.parse(payload)
  )
}

function respond(
  options: UtilityDispatcherOptions,
  requestId: string,
  payload: unknown
): void {
  options.parentPort.postMessage({
    kind: 'core.result',
    requestId,
    ok: true,
    payload
  })
}

function failure(
  options: UtilityDispatcherOptions,
  requestId: string,
  code: CapabilityErrorCode,
  retryable = false,
  issues: CapabilityError['issues'] = []
): void {
  options.parentPort.postMessage({
    kind: 'core.result',
    requestId,
    ok: false,
    error: capabilityFailureSchema.parse({
      code,
      retryable,
      ...(issues.length > 0 ? { issues } : {})
    })
  })
}

function capabilityFailure(error: unknown): {
  code: CapabilityErrorCode
  retryable: boolean
  issues: CapabilityError['issues']
} {
  if (error instanceof CapabilityError)
    return {
      code: error.code,
      retryable: error.retryable,
      issues: error.issues
    }
  return { code: 'internal', retryable: false, issues: [] }
}
