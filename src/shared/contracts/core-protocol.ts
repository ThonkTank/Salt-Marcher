import { z } from 'zod'
import { capabilityFailureSchema } from './campaign.js'
import { sessionChangeNoticeSchema } from './session-change.js'
import { referenceIndexChangeNoticeSchema } from './reference.js'
import { hexChangeNoticeSchema } from './hex.js'
import { worldLocationChangeNoticeSchema } from './world-location.js'
import { locationSymbolChangeNoticeSchema } from './location-symbol.js'
import { biomeChangeNoticeSchema } from './biome.js'
import {
  encounterTableChangeNoticeSchema,
  worldFactionChangeNoticeSchema
} from './encounter-source.js'
import { worldNpcChangeNoticeSchema } from './world-npc.js'
import { lootChangeNoticeSchema } from './loot.js'
import { sessionPreparationChangeNoticeSchema } from './session-planner.js'
import {
  coreOperations,
  isCoreOperationKind,
  type CoreOperationInput,
  type CoreOperationKind
} from './operations.js'
import type { OperationHandlers } from './operations/registry.js'
import { incompatibleDataPolicySchema } from './runtime.js'

const requestIdSchema = z.uuid()

export const coreStartupConfigurationSchema = z
  .object({
    dataRoot: z.string().min(1),
    referenceDatabasePath: z.string().min(1),
    sessionGenerationCatalogRoot: z.string().min(1),
    incompatibleDataPolicy: incompatibleDataPolicySchema
  })
  .strict()
  .readonly()

export type CoreStartupConfiguration = z.infer<
  typeof coreStartupConfigurationSchema
>

export const coreStartupFailureReasonSchema = z.enum([
  'incompatible-data',
  'corrupt-data',
  'access-denied',
  'resource-missing',
  'invalid-configuration',
  'internal'
])

export const coreStartupFailureSchema = z
  .object({
    kind: z.literal('core.startup-failed'),
    reason: coreStartupFailureReasonSchema,
    retryable: z.boolean()
  })
  .strict()
  .superRefine((failure, context) => {
    if (failure.retryable !== (failure.reason === 'internal'))
      context.addIssue({
        code: 'custom',
        path: ['retryable'],
        message: 'Only unexpected internal startup failures are retryable.'
      })
  })

export type CoreStartupFailure = z.infer<typeof coreStartupFailureSchema>
export type CoreStartupFailureReason = z.infer<
  typeof coreStartupFailureReasonSchema
>

export type CoreRequest = {
  [K in CoreOperationKind]: Readonly<{
    kind: 'core.request'
    requestId: string
    operation: K
    input: CoreOperationInput<K>
  }>
}[CoreOperationKind]

const requestEnvelopeSchema = z
  .object({
    kind: z.literal('core.request'),
    requestId: requestIdSchema,
    operation: z.string().min(1),
    input: z.unknown().optional()
  })
  .strict()

/** Runtime validation is driven by the same operation table used by IPC. */
export const coreRequestSchema = requestEnvelopeSchema.transform(
  (envelope, context): CoreRequest => {
    if (!isCoreOperationKind(envelope.operation)) {
      context.addIssue({
        code: 'custom',
        message: 'Unknown core operation',
        path: ['operation']
      })
      return z.NEVER
    }
    const definition = coreOperations[envelope.operation]
    const parsed = definition.input.safeParse(envelope.input)
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        context.addIssue({ ...issue, path: ['input', ...issue.path] })
      return z.NEVER
    }
    return {
      kind: 'core.request',
      requestId: envelope.requestId,
      operation: envelope.operation,
      input: parsed.data
    } as CoreRequest
  }
)

export const coreResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      kind: z.literal('core.result'),
      requestId: requestIdSchema,
      ok: z.literal(true),
      payload: z.unknown()
    })
    .strict(),
  z
    .object({
      kind: z.literal('core.result'),
      requestId: requestIdSchema,
      ok: z.literal(false),
      error: capabilityFailureSchema
    })
    .strict()
])

export type CoreResult = z.infer<typeof coreResultSchema>

export const coreRuntimeMetricsSchema = z
  .object({
    messagesReceived: z.number().int().nonnegative(),
    requestsCompleted: z.number().int().nonnegative(),
    eventsPublished: z.number().int().nonnegative(),
    scheduledWakeups: z.number().int().nonnegative(),
    activeDomainTimers: z.number().int().nonnegative(),
    uptimeMs: z.number().nonnegative(),
    bootstrap: z
      .object({
        totalMs: z.number().nonnegative(),
        phases: z.record(z.string(), z.number().nonnegative()).readonly()
      })
      .strict()
      .readonly()
  })
  .strict()
  .readonly()

export type CoreRuntimeMetrics = z.infer<typeof coreRuntimeMetricsSchema>

export const coreControlRequestSchema = z
  .object({
    kind: z.literal('core.control'),
    requestId: requestIdSchema,
    control: z.literal('runtime-metrics')
  })
  .strict()
  .readonly()

export const coreDiagnosticsSchema = z
  .object({
    kind: z.literal('core.diagnostics'),
    requestId: requestIdSchema,
    metrics: coreRuntimeMetricsSchema
  })
  .strict()
  .readonly()

export type CoreDiagnostics = z.infer<typeof coreDiagnosticsSchema>

export const coreEventSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('loot.changed'),
      notice: lootChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('session-planner.preparation-changed'),
      notice: sessionPreparationChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('session.changed'),
      notice: sessionChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('reference.changed'),
      notice: referenceIndexChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('hex.changed'),
      notice: hexChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('locations.changed'),
      notice: worldLocationChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('location-symbols.changed'),
      notice: locationSymbolChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('biomes.changed'),
      notice: biomeChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('encounter-tables.changed'),
      notice: encounterTableChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('npcs.changed'),
      notice: worldNpcChangeNoticeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('factions.changed'),
      notice: worldFactionChangeNoticeSchema
    })
    .strict()
])

export type CoreEvent = z.infer<typeof coreEventSchema>

export const coreReadySchema = z
  .object({ kind: z.literal('core.ready') })
  .strict()

export const coreMessageSchema = z.union([
  coreReadySchema,
  coreStartupFailureSchema,
  coreEventSchema,
  coreResultSchema,
  coreDiagnosticsSchema
])

export type CoreMessage = z.infer<typeof coreMessageSchema>

export type CoreHandlers = OperationHandlers<typeof coreOperations>
