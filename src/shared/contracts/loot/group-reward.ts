import { z } from 'zod'
import {
  groupRewardGeneratedRunSchema,
  groupRewardSourceEntrySchema
} from '../session-generation.js'
import { sceneGroupDispositionSchema } from '../scene.js'
import { sceneGroupCommandResultSchema } from '../live-session.js'
import { treasureSchema } from './treasure.js'

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
