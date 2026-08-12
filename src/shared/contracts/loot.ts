import { z } from 'zod'
import {
  groupRewardGeneratedRunSchema,
  groupRewardSourceEntrySchema
} from './session-generation.js'
import { sceneGroupDispositionSchema } from './scene.js'
import { sceneGroupCommandResultSchema } from './live-session.js'

export const lootRaritySchema = z.enum([
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary'
])

const lootCatalogTextListSchema = z.array(z.string().min(1))

export const lootCatalogQuerySchema = z
  .object({
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    search: z.string().trim().max(100).default(''),
    types: lootCatalogTextListSchema.default([]),
    categories: lootCatalogTextListSchema.default([]),
    rarities: z.array(lootRaritySchema).default([]),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(100).default(30)
  })
  .strict()

export const lootCatalogEntrySchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('item'),
      id: z.string().min(1),
      defaultName: z.string().min(1),
      type: z.string().min(1),
      category: z.string().min(1),
      unitValueCp: z.number().int().nonnegative(),
      stackable: z.boolean(),
      magic: z.literal(false),
      rarity: z.null()
    })
    .strict(),
  z
    .object({
      kind: z.literal('magic_item'),
      id: z.string().min(1),
      defaultName: z.string().min(1),
      type: z.string().min(1),
      category: z.null(),
      unitValueCp: z.literal(0),
      stackable: z.literal(false),
      magic: z.literal(true),
      rarity: lootRaritySchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('container'),
      id: z.string().min(1),
      defaultName: z.string().min(1),
      type: z.literal('container'),
      category: z.null(),
      capacity: z.number().nonnegative()
    })
    .strict()
])

export const lootCatalogPageSchema = z
  .object({
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    entries: z.array(lootCatalogEntrySchema),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    filterOptions: z
      .object({
        types: lootCatalogTextListSchema,
        categories: lootCatalogTextListSchema,
        rarities: z.array(lootRaritySchema)
      })
      .strict()
  })
  .strict()

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

export const treasureContainerSchema = z
  .object({
    id: z.uuid(),
    catalogContainerId: z.string().min(1).nullable(),
    name: z.string().min(1),
    capacity: z.number().nonnegative(),
    position: z.number().int().nonnegative()
  })
  .strict()

export const treasureItemSchema = z
  .object({
    id: z.uuid(),
    sourceLineId: z.string().min(1).nullable(),
    catalogItemId: z.string().min(1).nullable(),
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
        .object({
          groupId: z.uuid(),
          treasures: z.array(treasureSchema)
        })
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

export const generateGroupDraftLootInputSchema = z
  .object({
    sceneId: z.uuid(),
    groupId: z.uuid(),
    expectedSceneRevision: z.number().int().nonnegative(),
    expectedGroupRevision: z.number().int().nonnegative().nullable(),
    expectedPartyRevision: z.number().int().nonnegative(),
    expectedCampaignRulesRevision: z.number().int().nonnegative(),
    entries: z.array(groupRewardSourceEntrySchema).min(1),
    seed: z.number().int().nonnegative().safe()
  })
  .strict()

export const generateGroupDraftLootResultSchema = z
  .object({ run: groupRewardGeneratedRunSchema })
  .strict()

export const groupRewardTreasureItemOriginSchema = z.discriminatedUnion(
  'kind',
  [
    z
      .object({
        kind: z.literal('generator'),
        sourceLineId: z.string().min(1)
      })
      .strict(),
    z
      .object({
        kind: z.literal('catalog'),
        entryKind: z.enum(['item', 'magic_item']),
        catalogId: z.string().min(1)
      })
      .strict()
  ]
)

export const groupRewardTreasureContainerOriginSchema = z.discriminatedUnion(
  'kind',
  [
    z
      .object({
        kind: z.literal('generator'),
        sourceContainerId: z.string().min(1)
      })
      .strict(),
    z
      .object({
        kind: z.literal('catalog'),
        catalogContainerId: z.string().min(1)
      })
      .strict()
  ]
)

export const groupRewardTreasureItemDraftSchema = z
  .object({
    id: z.uuid(),
    origin: groupRewardTreasureItemOriginSchema,
    name: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    unitValueCp: z.number().int().nonnegative(),
    stackable: z.boolean(),
    containerId: z.uuid().nullable()
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

export const groupRewardTreasureContainerDraftSchema = z
  .object({
    id: z.uuid(),
    origin: groupRewardTreasureContainerOriginSchema,
    name: z.string().trim().min(1),
    capacity: z.number().nonnegative()
  })
  .strict()

export const groupRewardTreasureDraftSchema = z
  .object({
    label: z.string().trim().min(1),
    containers: z.array(groupRewardTreasureContainerDraftSchema),
    items: z.array(groupRewardTreasureItemDraftSchema).min(1)
  })
  .strict()
  .superRefine((draft, context) => {
    const ids = new Set<string>()
    for (const [index, container] of draft.containers.entries()) {
      if (ids.has(container.id))
        context.addIssue({
          code: 'custom',
          path: ['containers', index, 'id'],
          message: 'Draft identities must be unique.'
        })
      ids.add(container.id)
    }
    for (const [index, item] of draft.items.entries()) {
      if (ids.has(item.id))
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: 'Draft identities must be unique.'
        })
      ids.add(item.id)
      if (
        item.containerId !== null &&
        !draft.containers.some((container) => container.id === item.containerId)
      )
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'containerId'],
          message: 'Assigned draft container does not exist.'
        })
    }
  })

export const commitGroupRewardInputSchema = z
  .object({
    commandId: z.uuid(),
    runId: z.uuid(),
    generatedTreasureId: z.string().min(1),
    treasureDraft: groupRewardTreasureDraftSchema,
    sceneId: z.uuid(),
    groupId: z.uuid(),
    expectedSceneRevision: z.number().int().nonnegative(),
    expectedGroupRevision: z.number().int().nonnegative().nullable(),
    name: z.string().trim().max(100),
    note: z.string().trim().max(1_000),
    disposition: sceneGroupDispositionSchema,
    entries: z.array(groupRewardSourceEntrySchema).min(1)
  })
  .strict()

export const commitGroupRewardResultSchema = z
  .object({
    groupResult: sceneGroupCommandResultSchema,
    treasure: treasureSchema
  })
  .strict()

export const distributionShareSchema = z
  .object({
    characterId: z.uuid(),
    quantity: z.number().int().positive()
  })
  .strict()

export const distributionItemSchema = z
  .object({
    itemId: z.uuid(),
    shares: z.array(distributionShareSchema).min(1)
  })
  .strict()

export const completeLootDistributionInputSchema = z
  .object({
    commandId: z.uuid(),
    treasureId: z.uuid(),
    expectedTreasureRevision: z.number().int().nonnegative(),
    expectedPartyRevision: z.number().int().nonnegative(),
    items: z.array(distributionItemSchema).min(1)
  })
  .strict()

export const characterLootStatusSchema = z.enum([
  'received',
  'given_away',
  'sold'
])

export const characterLootEntrySchema = z
  .object({
    id: z.uuid(),
    characterId: z.uuid(),
    treasureId: z.uuid().nullable(),
    treasureItemId: z.uuid().nullable(),
    source: z.enum(['award', 'manual', 'purchase', 'correction']),
    itemName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitValueCp: z.number().int().nonnegative(),
    status: characterLootStatusSchema,
    provenance: z
      .object({
        kind: z.literal('treasure_distribution'),
        treasureLabel: z.string().min(1),
        recipientName: z.string().min(1)
      })
      .strict(),
    rewardProvenance: z
      .object({
        runId: z.uuid(),
        generatedTreasureId: z.string().min(1),
        rewardChannel: z.enum(['encounter', 'quest', 'environment'])
      })
      .strict()
      .nullable()
      .default(null),
    correctsEntryId: z.uuid().nullable().default(null),
    supersededByEntryId: z.uuid().nullable().default(null),
    correctionReason: z.string().min(1).nullable().default(null),
    receivedAt: z.iso.datetime()
  })
  .strict()

export const characterLootLedgerSchema = z
  .object({
    characterId: z.uuid(),
    revision: z.number().int().nonnegative().default(0),
    entries: z.array(characterLootEntrySchema)
  })
  .strict()

export const characterLootInputSchema = z
  .object({ characterId: z.uuid() })
  .strict()

export const correctCharacterLootInputSchema = z
  .object({
    commandId: z.uuid(),
    characterId: z.uuid(),
    entryId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    itemName: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    unitValueCp: z.number().int().nonnegative(),
    status: characterLootStatusSchema,
    reason: z.string().trim().min(1).max(500)
  })
  .strict()

export const lootDistributionResultSchema = z
  .object({
    treasure: treasureSchema,
    createdEntries: z.array(characterLootEntrySchema)
  })
  .strict()

export type TreasureAnchor = Readonly<z.infer<typeof treasureAnchorSchema>>
export type LootRarity = z.infer<typeof lootRaritySchema>
export type TreasureSource = Readonly<z.infer<typeof treasureSourceSchema>>
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
export type LootCatalogQuery = Readonly<z.infer<typeof lootCatalogQuerySchema>>
export type LootCatalogEntry = Readonly<z.infer<typeof lootCatalogEntrySchema>>
export type LootCatalogPage = Readonly<z.infer<typeof lootCatalogPageSchema>>
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
export type CompleteLootDistributionInput = Readonly<
  z.infer<typeof completeLootDistributionInputSchema>
>
export type CharacterLootEntry = Readonly<
  z.infer<typeof characterLootEntrySchema>
>
export type CharacterLootLedger = Readonly<
  z.infer<typeof characterLootLedgerSchema>
>
export type CorrectCharacterLootInput = Readonly<
  z.infer<typeof correctCharacterLootInputSchema>
>
export type LootDistributionResult = Readonly<
  z.infer<typeof lootDistributionResultSchema>
>
export type GenerateGroupDraftLootInput = Readonly<
  z.infer<typeof generateGroupDraftLootInputSchema>
>
export type GenerateGroupDraftLootResult = Readonly<
  z.infer<typeof generateGroupDraftLootResultSchema>
>
export type CommitGroupRewardInput = Readonly<
  z.infer<typeof commitGroupRewardInputSchema>
>
export type CommitGroupRewardResult = Readonly<
  z.infer<typeof commitGroupRewardResultSchema>
>
export type GroupRewardTreasureItemOrigin = Readonly<
  z.infer<typeof groupRewardTreasureItemOriginSchema>
>
export type GroupRewardTreasureContainerOrigin = Readonly<
  z.infer<typeof groupRewardTreasureContainerOriginSchema>
>
export type GroupRewardTreasureItemDraft = Readonly<
  z.infer<typeof groupRewardTreasureItemDraftSchema>
>
export type GroupRewardTreasureContainerDraft = Readonly<
  z.infer<typeof groupRewardTreasureContainerDraftSchema>
>
export type GroupRewardTreasureDraft = Readonly<
  z.infer<typeof groupRewardTreasureDraftSchema>
>
