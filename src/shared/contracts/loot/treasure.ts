import { z } from 'zod'
import { lootRaritySchema } from './catalog.js'

export const treasureAnchorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unplaced') }).strict(),
  z
    .object({
      kind: z.literal('location'),
      locationId: z.uuid(),
      lastKnownLabel: z.string().min(1)
    })
    .strict(),
  z
    .object({
      kind: z.literal('group'),
      sceneId: z.uuid(),
      groupId: z.uuid(),
      lastKnownLabel: z.string().min(1)
    })
    .strict()
])

export const treasureSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }).strict(),
  z
    .object({
      kind: z.literal('generated'),
      runId: z.uuid(),
      generatedTreasureId: z.string().min(1)
    })
    .strict()
])

export const catalogItemReferenceSchema = z
  .object({
    kind: z.enum(['item', 'magic_item']),
    id: z.string().min(1)
  })
  .strict()

export const treasureContainerProvenanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }).strict(),
  z
    .object({
      kind: z.literal('generator'),
      sourceContainerId: z.string().min(1),
      catalogContainerId: z.string().min(1).nullable()
    })
    .strict(),
  z
    .object({
      kind: z.literal('catalog'),
      catalogContainerId: z.string().min(1)
    })
    .strict()
])

export const treasureItemProvenanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }).strict(),
  z
    .object({
      kind: z.literal('generator'),
      sourceLineId: z.string().min(1),
      catalogEntry: catalogItemReferenceSchema.nullable()
    })
    .strict(),
  z
    .object({
      kind: z.literal('catalog'),
      catalogEntry: catalogItemReferenceSchema
    })
    .strict()
])

export const treasureContainerSchema = z
  .object({
    id: z.uuid(),
    sourceContainerId: z.string().min(1).nullable(),
    catalogContainerId: z.string().min(1).nullable(),
    provenance: treasureContainerProvenanceSchema,
    name: z.string().min(1),
    capacity: z.number().nonnegative(),
    position: z.number().int().nonnegative()
  })
  .strict()

export const treasureItemSchema = z
  .object({
    id: z.uuid(),
    sourceLineId: z.string().min(1).nullable(),
    catalogEntryKind: z.enum(['item', 'magic_item']).nullable(),
    catalogItemId: z.string().min(1).nullable(),
    provenance: treasureItemProvenanceSchema,
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    allocatedQuantity: z.number().int().nonnegative(),
    unitValueCp: z.number().int().nonnegative(),
    stackable: z.boolean(),
    magic: z.boolean(),
    rarity: lootRaritySchema.nullable(),
    curseName: z.string().min(1).nullable(),
    containerId: z.uuid().nullable(),
    position: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((item, context) => {
    if (item.allocatedQuantity > item.quantity)
      context.addIssue({
        code: 'custom',
        path: ['allocatedQuantity'],
        message: 'Allocated quantity exceeds the item quantity.'
      })
  })

export const treasureSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    label: z.string().min(1),
    anchor: treasureAnchorSchema,
    source: treasureSourceSchema,
    items: z.array(treasureItemSchema),
    containers: z.array(treasureContainerSchema),
    totalValueCp: z.number().int().nonnegative(),
    allocatedValueCp: z.number().int().nonnegative(),
    distributionState: z.enum(['open', 'partial', 'complete']).default('open'),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export const lootSceneProjectionSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    sceneId: z.uuid(),
    locationId: z.uuid().nullable(),
    locationTreasures: z.array(treasureSchema),
    groupTreasures: z.array(
      z
        .object({ groupId: z.uuid(), treasures: z.array(treasureSchema) })
        .strict()
    )
  })
  .strict()

export const lootInboxInputSchema = z
  .object({
    cursor: z.string().min(1).nullable(),
    limit: z.number().int().min(1).max(100)
  })
  .strict()

export const lootInboxPageSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    entries: z.array(
      z
        .object({
          treasure: treasureSchema,
          reason: z.enum([
            'unplaced',
            'missing_location',
            'missing_scene',
            'missing_group'
          ]),
          lastKnownLabel: z.string().min(1).nullable()
        })
        .strict()
    ),
    nextCursor: z.string().min(1).nullable()
  })
  .strict()

export const lootChangeNoticeSchema = z
  .object({
    campaignId: z.uuid(),
    revision: z.number().int().nonnegative(),
    reason: z.enum(['created', 'updated', 'moved', 'accepted', 'distributed'])
  })
  .strict()
  .readonly()

export const treasureItemDraftSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    unitValueCp: z.number().int().nonnegative(),
    stackable: z.boolean(),
    containerId: z.uuid().nullable().default(null)
  })
  .strict()
  .superRefine((item, context) => {
    if (!item.stackable && item.quantity !== 1)
      context.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Non-stackable items must have quantity one.'
      })
  })

export const treasureContainerDraftSchema = z
  .object({
    id: z.uuid(),
    catalogContainerId: z.string().min(1).nullable(),
    name: z.string().trim().min(1),
    capacity: z.number().nonnegative()
  })
  .strict()

export const createTreasureInputSchema = z
  .object({
    commandId: z.uuid(),
    label: z.string().trim().min(1),
    anchor: treasureAnchorSchema,
    containers: z.array(treasureContainerDraftSchema).default([]),
    items: z.array(treasureItemDraftSchema)
  })
  .strict()

export const updateTreasureInputSchema = z
  .object({
    commandId: z.uuid(),
    treasureId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    label: z.string().trim().min(1),
    anchor: treasureAnchorSchema,
    containers: z.array(treasureContainerDraftSchema).default([]),
    items: z.array(treasureItemDraftSchema)
  })
  .strict()

export const moveTreasureInputSchema = z
  .object({
    commandId: z.uuid(),
    treasureId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    anchor: treasureAnchorSchema
  })
  .strict()

export const acceptGeneratedTreasureInputSchema = z
  .object({
    commandId: z.uuid(),
    runId: z.uuid(),
    generatedTreasureId: z.string().min(1),
    label: z.string().trim().min(1),
    anchor: treasureAnchorSchema
  })
  .strict()

export const treasureIdInputSchema = z.object({ treasureId: z.uuid() }).strict()
export const sceneLootInputSchema = z.object({ sceneId: z.uuid() }).strict()

export type TreasureAnchor = Readonly<z.infer<typeof treasureAnchorSchema>>
export type TreasureSource = Readonly<z.infer<typeof treasureSourceSchema>>
export type TreasureItemProvenance = Readonly<
  z.infer<typeof treasureItemProvenanceSchema>
>
export type TreasureContainerProvenance = Readonly<
  z.infer<typeof treasureContainerProvenanceSchema>
>
export type Treasure = Readonly<z.infer<typeof treasureSchema>>
export type TreasureItem = Readonly<z.infer<typeof treasureItemSchema>>
export type TreasureItemDraft = Readonly<
  z.infer<typeof treasureItemDraftSchema>
>
export type TreasureContainerDraft = Readonly<
  z.infer<typeof treasureContainerDraftSchema>
>
export type LootSceneProjection = Readonly<
  z.infer<typeof lootSceneProjectionSchema>
>
export type LootInboxInput = Readonly<z.infer<typeof lootInboxInputSchema>>
export type LootInboxPage = Readonly<z.infer<typeof lootInboxPageSchema>>
export type LootChangeNotice = Readonly<z.infer<typeof lootChangeNoticeSchema>>
export type CreateTreasureInput = Readonly<
  z.input<typeof createTreasureInputSchema>
>
export type UpdateTreasureInput = Readonly<
  z.input<typeof updateTreasureInputSchema>
>
export type ParsedCreateTreasureInput = Readonly<
  z.output<typeof createTreasureInputSchema>
>
export type ParsedUpdateTreasureInput = Readonly<
  z.output<typeof updateTreasureInputSchema>
>
export type MoveTreasureInput = Readonly<
  z.infer<typeof moveTreasureInputSchema>
>
export type AcceptGeneratedTreasureInput = Readonly<
  z.infer<typeof acceptGeneratedTreasureInputSchema>
>
