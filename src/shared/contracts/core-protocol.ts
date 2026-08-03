import { z } from 'zod'
import { capabilityFailureSchema } from './campaign.js'
import { sessionChangeNoticeSchema } from './session-change.js'
import {
  coreOperations,
  isCoreOperationKind,
  type CoreOperationInput,
  type CoreOperationKind
} from './operations.js'

const requestIdSchema = z.uuid()

export type CoreRequest = {
  [K in CoreOperationKind]: Readonly<{
    requestId: string
    kind: K
    input: CoreOperationInput<K>
  }>
}[CoreOperationKind]

const requestEnvelopeSchema = z
  .object({
    requestId: requestIdSchema,
    kind: z.string().min(1),
    input: z.unknown().optional()
  })
  .strict()

/** Runtime validation is driven by the same operation table used by IPC. */
export const coreRequestSchema = requestEnvelopeSchema.transform(
  (envelope, context): CoreRequest => {
    if (!isCoreOperationKind(envelope.kind)) {
      context.addIssue({
        code: 'custom',
        message: 'Unknown core operation',
        path: ['kind']
      })
      return z.NEVER
    }
    const definition = coreOperations[envelope.kind]
    const parsed = definition.input.safeParse(envelope.input)
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        context.addIssue({ ...issue, path: ['input', ...issue.path] })
      return z.NEVER
    }
    return {
      requestId: envelope.requestId,
      kind: envelope.kind,
      input: parsed.data
    } as CoreRequest
  }
)

export const coreResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      requestId: requestIdSchema,
      ok: z.literal(true),
      payload: z.unknown()
    })
    .strict(),
  z
    .object({
      requestId: requestIdSchema,
      ok: z.literal(false),
      error: capabilityFailureSchema
    })
    .strict()
])

export const coreEventSchema = z
  .object({
    kind: z.literal('session.changed'),
    notice: sessionChangeNoticeSchema
  })
  .strict()

export type CoreHandlers = {
  [K in CoreOperationKind]: (input: CoreOperationInput<K>) => unknown
}
