import { z } from 'zod'

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

export const worldNpcListRowSchema = worldNpcSchema
  .pick({
    id: true,
    displayName: true,
    creatureId: true,
    lifecycle: true,
    dispositionModifier: true,
    factionId: true,
    locationId: true,
    position: true
  })
  .extend({
    creatureDisplayName: z.string().min(1).max(300),
    factionDisplayName: z.string().min(1).max(100).nullable(),
    locationDisplayName: z.string().min(1).max(100).nullable()
  })
  .strict()

export const worldNpcSearchInputSchema = z
  .object({
    query: z.string().trim().max(100).default(''),
    lifecycle: worldNpcLifecycleSchema.nullable().default(null),
    creatureId: z.string().min(1).max(300).nullable().default(null),
    factionId: z.uuid().nullable().optional(),
    locationId: z.uuid().nullable().optional(),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(100).default(50)
  })
  .strict()

export const worldNpcPageSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    rows: z.array(worldNpcListRowSchema),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100)
  })
  .strict()

export const worldNpcDetailInputSchema = z.object({ id: z.uuid() }).strict()
export const worldNpcDetailProjectionSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    npc: worldNpcSchema,
    creatureDisplayName: z.string().min(1).max(300),
    factionDisplayName: z.string().min(1).max(100).nullable(),
    locationDisplayName: z.string().min(1).max(100).nullable()
  })
  .strict()

const mutationBaseSchema = z
  .object({
    commandId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    expectedFactionRevision: z.number().int().nonnegative().nullable()
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
  .object({
    revision: z.number().int().nonnegative(),
    factionRevision: z.number().int().nonnegative(),
    saved: worldNpcSchema
  })
  .strict()
export const worldNpcDeleteReceiptSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    factionRevision: z.number().int().nonnegative(),
    deletedId: z.uuid()
  })
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
export type WorldNpcSearchInput = Readonly<
  z.input<typeof worldNpcSearchInputSchema>
>
export type WorldNpcPage = Readonly<z.infer<typeof worldNpcPageSchema>>
export type WorldNpcListRow = Readonly<z.infer<typeof worldNpcListRowSchema>>
export type WorldNpcDetailProjection = Readonly<
  z.infer<typeof worldNpcDetailProjectionSchema>
>
export type WorldNpcChangeNotice = Readonly<
  z.infer<typeof worldNpcChangeNoticeSchema>
>
export type WorldNpcMutationReceipt = Readonly<
  z.infer<typeof worldNpcMutationReceiptSchema>
>
export type WorldNpcDeleteReceipt = Readonly<
  z.infer<typeof worldNpcDeleteReceiptSchema>
>
