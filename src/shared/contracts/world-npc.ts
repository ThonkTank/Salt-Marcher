import { z } from 'zod'
import type {
  EntityDeleteReceipt,
  EntityMutationReceipt
} from './entity-mutation.js'

export const worldNpcLifecycleSchema = z.enum(['active', 'defeated'])

export const worldNpcSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100),
    creatureId: z.string().min(1).max(300),
    lifecycle: worldNpcLifecycleSchema,
    appearance: z.string().max(20_000),
    behavior: z.string().max(20_000),
    history: z.string().max(20_000),
    notes: z.string().max(20_000),
    dispositionModifier: z.number().int().min(-50).max(50),
    factionId: z.uuid().nullable(),
    locationId: z.uuid().nullable(),
    position: z.number().int().nonnegative()
  })
  .strict()

export const worldNpcDraftSchema = worldNpcSchema
  .omit({ id: true, position: true })
  .extend({
    displayName: z.string().trim().min(1).max(100),
    appearance: z.string().trim().max(20_000),
    behavior: z.string().trim().max(20_000),
    history: z.string().trim().max(20_000),
    notes: z.string().trim().max(20_000)
  })
  .strict()

export const worldNpcSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    npcs: z.array(worldNpcSchema)
  })
  .strict()

const mutationBaseSchema = z
  .object({
    commandId: z.uuid(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const createWorldNpcInputSchema = mutationBaseSchema
  .extend({ npc: worldNpcDraftSchema })
  .strict()
export const updateWorldNpcInputSchema = createWorldNpcInputSchema
  .extend({ id: z.uuid() })
  .strict()
export const deleteWorldNpcInputSchema = mutationBaseSchema
  .extend({ id: z.uuid() })
  .strict()
export const worldNpcCommandReceiptInputSchema = z
  .object({ commandId: z.uuid() })
  .strict()

export const worldNpcMutationReceiptSchema = z
  .object({ snapshot: worldNpcSnapshotSchema, saved: worldNpcSchema })
  .strict()
export const worldNpcDeleteReceiptSchema = z
  .object({ snapshot: worldNpcSnapshotSchema, deletedId: z.uuid() })
  .strict()
export const worldNpcCommandReceiptSchema = z.union([
  worldNpcMutationReceiptSchema,
  worldNpcDeleteReceiptSchema
])

export const worldNpcChangeNoticeSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    changedNpcIds: z.array(z.uuid()),
    reason: z.enum(['created', 'updated', 'deleted', 'reference-unlinked'])
  })
  .strict()
  .readonly()

export type WorldNpc = Readonly<z.infer<typeof worldNpcSchema>>
export type WorldNpcDraft = Readonly<z.input<typeof worldNpcDraftSchema>>
export type WorldNpcSnapshot = Readonly<z.infer<typeof worldNpcSnapshotSchema>>
export type WorldNpcChangeNotice = Readonly<
  z.infer<typeof worldNpcChangeNoticeSchema>
>
export type WorldNpcMutationReceipt = EntityMutationReceipt<
  WorldNpcSnapshot,
  WorldNpc
>
export type WorldNpcDeleteReceipt = EntityDeleteReceipt<WorldNpcSnapshot>
