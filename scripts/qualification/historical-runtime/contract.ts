import { z } from 'zod'

export const historicalOperationSchema = z.enum([
  'identity',
  'seed',
  'read',
  'advance',
  'advance-combat',
  'finish-combat-and-travel',
  'migrate',
  'migrate-kill'
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

export const historicalInterruptionSchema = z
  .object({
    requestId: z.uuid(),
    pid: z.number().int().positive(),
    signal: z.literal('SIGKILL'),
    boundary: z
      .object({
        id: z.string().min(1),
        role: z.enum(['installation', 'campaign']),
        fromVersion: z.number().int().nonnegative(),
        toVersion: z.number().int().positive(),
        inTransaction: z.literal(true)
      })
      .strict()
  })
  .strict()
