import { z } from 'zod'
import {
  groupRewardGenerationResultSchema,
  groupRewardSourceEntrySchema
} from '../session-generation.js'
import { sceneGroupDispositionSchema } from '../scene.js'
import { sceneGroupCommandResultSchema } from '../live-session.js'
import { treasureSchema } from './treasure.js'
import { itemReferenceSchema } from './item-definition.js'

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

export const generateGroupDraftLootResultSchema =
  groupRewardGenerationResultSchema

export const groupRewardTreasureItemOriginSchema = z.discriminatedUnion(
  'kind',
  [
    z
      .object({ kind: z.literal('generator'), sourceLineId: z.string().min(1) })
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
    sourceLineId: z.string().min(1).nullable(),
    itemReference: itemReferenceSchema,
    quantity: z.number().int().positive(),
    containerId: z.uuid().nullable()
  })
  .strict()

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

export const commitGroupRewardInputSchema = z
  .object({
    commandId: z.uuid(),
    runId: z.uuid(),
    generatedTreasureId: z.string().min(1).nullable(),
    treasureDraft: groupRewardTreasureDraftSchema.nullable(),
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
  .refine(
    (input) =>
      (input.generatedTreasureId === null) === (input.treasureDraft === null),
    {
      message:
        'Generated Treasure identity and draft must both be present or absent.',
      path: ['treasureDraft']
    }
  )

export const commitGroupRewardResultSchema = z
  .object({
    groupResult: sceneGroupCommandResultSchema,
    treasure: treasureSchema.nullable()
  })
  .strict()

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
