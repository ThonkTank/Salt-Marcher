import { z } from 'zod'

export const releaseQualificationMarkerSchema = z
  .object({
    formatVersion: z.literal(1),
    runId: z.uuid(),
    root: z.string().min(1)
  })
  .strict()
export const releaseInspectionRequestSchema = z
  .object({
    requestId: z.uuid(),
    operation: z.enum(['identity', 'read']),
    profile: z.string().min(1)
  })
  .strict()
export const releaseInspectionResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({ ok: z.literal(true), requestId: z.uuid(), result: z.unknown() })
    .strict(),
  z
    .object({ ok: z.literal(false), requestId: z.uuid(), message: z.string() })
    .strict()
])
