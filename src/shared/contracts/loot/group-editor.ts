import { z } from 'zod'
import { saveSceneGroupInputSchema } from '../scene.js'
import { sceneGroupCommandResultSchema } from '../live-session.js'
import { lootRarityKeys } from '../generator-loot-rules.js'
import {
  treasureContainerDraftSchema,
  treasureItemDraftSchema,
  treasureSchema
} from './treasure.js'

export const groupEditorTreasureSchema = z
  .object({
    key: z.string().min(1),
    treasureId: z.uuid().nullable(),
    expectedRevision: z.number().int().nonnegative().nullable(),
    label: z.string().trim().min(1).max(200),
    generation: z
      .object({ runId: z.uuid(), treasureId: z.string().min(1) })
      .strict()
      .nullable()
      .optional(),
    containers: z.array(
      treasureContainerDraftSchema.extend({
        sourceContainerId: z.string().min(1).nullable().optional()
      })
    ),
    items: z.array(
      treasureItemDraftSchema.extend({
        sourceLineId: z.string().min(1).nullable().optional()
      })
    )
  })
  .strict()
  .refine(
    (v) => (v.treasureId === null) === (v.expectedRevision === null),
    'Treasure identity and revision must match'
  )

const groupEditorBaseSchema = saveSceneGroupInputSchema
  .extend({
    prospectiveGroupId: z.uuid(),
    treasures: z.array(groupEditorTreasureSchema).max(100)
  })
  .strict()
function uniqueTreasures(
  v: { treasures: readonly { key: string; treasureId: string | null }[] },
  ctx: z.RefinementCtx
) {
  for (const values of [
    v.treasures.map((t) => t.key),
    v.treasures.flatMap((t) => (t.treasureId ? [t.treasureId] : []))
  ])
    if (new Set(values).size !== values.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate Treasure',
        path: ['treasures']
      })
}
export const commitGroupEditorInputSchema =
  groupEditorBaseSchema.superRefine(uniqueTreasures)
export const commitGroupEditorResultSchema = z
  .object({
    groupResult: sceneGroupCommandResultSchema,
    treasures: z.array(
      z.object({ key: z.string(), treasure: treasureSchema }).strict()
    )
  })
  .strict()
export const evaluateGroupLootInputSchema = groupEditorBaseSchema
  .omit({ commandId: true, name: true, note: true, disposition: true })
  .extend({
    budgetSeed: z.number().int().nonnegative().safe()
  })
  .strict()
  .superRefine(uniqueTreasures)
const rarities = z.record(
  z.enum(lootRarityKeys),
  z.number().int().nonnegative().safe()
)
export const groupLootBalanceSchema = z
  .object({
    status: z.enum([
      'ready',
      'missing_party',
      'missing_level',
      'empty_roster',
      'unavailable_creature'
    ]),
    currentCoinsCp: z.number().int().nonnegative().safe(),
    currentItemsCp: z.number().int().nonnegative().safe(),
    currentValueCp: z.number().int().nonnegative().safe(),
    targetValueCp: z.number().int().nonnegative().safe().nullable(),
    differenceCp: z.number().int().safe().nullable(),
    currentMagic: rarities,
    targetMagic: rarities.nullable(),
    tolerance: z.number().nonnegative(),
    band: z.enum(['below', 'within', 'above']).nullable(),
    rewardXp: z.number().int().nonnegative().nullable(),
    rewardXpBasis: z.enum(['base', 'adjusted']),
    partyRevision: z.number().int().nonnegative(),
    rulesRevision: z.number().int().nonnegative()
  })
  .strict()
export type GroupEditorTreasure = z.infer<typeof groupEditorTreasureSchema>
export type CommitGroupEditorInput = z.infer<
  typeof commitGroupEditorInputSchema
>
export type CommitGroupEditorResult = z.infer<
  typeof commitGroupEditorResultSchema
>
export type EvaluateGroupLootInput = z.infer<
  typeof evaluateGroupLootInputSchema
>
export type GroupLootBalance = z.infer<typeof groupLootBalanceSchema>
