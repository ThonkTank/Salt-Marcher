import { z } from 'zod'
import { capabilityFailureSchema } from './campaign.js'

export const ipcResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), payload: z.unknown() }).strict(),
  z.object({ ok: z.literal(false), error: capabilityFailureSchema }).strict()
])

export type IpcResult<T> =
  | Readonly<{ ok: true; payload: T }>
  | Readonly<{
      ok: false
      error: z.infer<typeof capabilityFailureSchema>
    }>

export type CapabilityBridge = Readonly<Record<string, unknown>>
