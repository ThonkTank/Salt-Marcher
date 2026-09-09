import { z } from 'zod'

export const historicalOperationSchema = z.enum([
  'identity',
  'seed',
  'read',
  'advance',
  'advance-combat',
  'finish-combat-and-travel',
  'migrate'
])
export const historicalRequestSchema = z
  .object({
    requestId: z.uuid(),
    operation: historicalOperationSchema,
    profile: z.string().min(1)
  })
  .strict()
export const historicalResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({ ok: z.literal(true), requestId: z.uuid(), result: z.unknown() })
    .strict(),
  z
    .object({ ok: z.literal(false), requestId: z.uuid(), message: z.string() })
    .strict()
])
