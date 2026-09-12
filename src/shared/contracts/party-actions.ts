import { z } from 'zod'
import { liveSessionSnapshotSchema } from './live-session.js'
import { installationSettingsSchema } from './settings.js'
import { partyQuickFieldSchema } from './party-quick-fields.js'
const scope = { campaignId: z.uuid() }
const entry = z
  .object({
    id: z.uuid(),
    description: z.string(),
    blockedReason: z.string().nullable()
  })
  .strict()
  .readonly()
export const partyHistoryScopeSchema = z.object(scope).strict().readonly()
export const partyHistorySchema = z
  .object({
    undo: entry.nullable(),
    redo: entry.nullable(),
    pending: z.boolean()
  })
  .strict()
  .readonly()
export const partyHistoryCommandSchema = z
  .object({
    ...scope,
    commandId: z.uuid(),
    stepId: z.uuid(),
    direction: z.enum(['undo', 'redo'])
  })
  .strict()
  .readonly()
export const partyQuickFieldsCommandSchema = z
  .object({
    ...scope,
    commandId: z.uuid(),
    fields: z
      .array(partyQuickFieldSchema)
      .max(10)
      .refine((fields) => new Set(fields).size === fields.length),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()
  .readonly()
export const partyActionResultSchema = z
  .object({
    snapshot: liveSessionSnapshotSchema,
    settings: installationSettingsSchema,
    history: partyHistorySchema
  })
  .strict()
  .readonly()
export const partyActionStatusSchema = z
  .object({ committed: z.boolean(), result: partyActionResultSchema })
  .strict()
  .readonly()
export type PartyHistoryCommand = z.infer<typeof partyHistoryCommandSchema>
export type PartyQuickFieldsCommand = z.infer<
  typeof partyQuickFieldsCommandSchema
>
export type PartyHistory = z.infer<typeof partyHistorySchema>
