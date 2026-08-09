import { z } from 'zod'
import {
  generatorChallengeRatings,
  generatorRoles,
  maximumCompositionComplexity,
  maximumGeneratorCandidateCount
} from '../generator/generator-config-model.js'
export type {
  GeneratorRole,
  GeneratorRoleCell,
  GeneratorRoleMatrix
} from '../generator/generator-config-model.js'
export const generatorPresetSchemaVersion = 3 as const
export const systemGeneratorPresetId = '00000000-0000-4000-8000-000000000001'
export const generatorRoleSchema = z.enum(generatorRoles)
export const generatorRoleCellSchema = z.enum(['none', ...generatorRoles])

export const integerRangeSchema = z
  .object({
    min: z.number().int().positive().max(999),
    max: z.number().int().positive().max(999)
  })
  .strict()
  .refine((value) => value.min <= value.max, 'Minimum must not exceed maximum.')
export type IntegerRange = z.infer<typeof integerRangeSchema>

export const scaledBoundarySchema = z
  .object({
    value: z.number().nonnegative().max(999),
    perPlayer: z.boolean()
  })
  .strict()
export type ScaledBoundary = z.infer<typeof scaledBoundarySchema>

export const scaledRangeSchema = z
  .object({ min: scaledBoundarySchema, max: scaledBoundarySchema })
  .strict()
  .superRefine((range, context) => {
    const validForEveryPositivePartySize =
      range.min.perPlayer === range.max.perPlayer
        ? range.min.value <= range.max.value
        : !range.min.perPlayer && range.max.perPlayer
          ? range.min.value <= range.max.value
          : range.min.value === 0
    if (!validForEveryPositivePartySize)
      context.addIssue({
        code: 'custom',
        message: 'Range must remain ordered for every positive party size.'
      })
  })
export type ScaledRange = z.infer<typeof scaledRangeSchema>

const difficultyWeightsSchema = z
  .object({
    trivial: z.number().int().nonnegative().max(100),
    easy: z.number().int().nonnegative().max(100),
    medium: z.number().int().nonnegative().max(100),
    hard: z.number().int().nonnegative().max(100),
    deadly: z.number().int().nonnegative().max(100)
  })
  .strict()
  .refine(
    (value) =>
      Object.values(value).reduce((sum, part) => sum + part, 0) === 100,
    'Difficulty weights must total 100.'
  )

const roleQuantitySchema = integerRangeSchema.refine(
  (value) => value.max <= 99,
  'Role quantity must not exceed 99.'
)

const roleQuantitiesSchema = z
  .object({
    minion: roleQuantitySchema,
    support: roleQuantitySchema,
    standard: roleQuantitySchema,
    elite: roleQuantitySchema,
    boss: roleQuantitySchema
  })
  .strict()

const roleCombinationSchema = z
  .array(generatorRoleSchema)
  .min(1)
  .max(3)
  .refine(
    (roles) => new Set(roles).size === roles.length,
    'Roles must be unique.'
  )

const roleMatrixRowSchema = z
  .array(generatorRoleCellSchema)
  .length(generatorChallengeRatings.length)
export const generatorRoleMatrixSchema = z.array(roleMatrixRowSchema).length(20)

const compositionConfigSchema = z
  .object({
    roleMatrix: generatorRoleMatrixSchema,
    roleQuantities: roleQuantitiesSchema,
    roleCombinations: z.array(roleCombinationSchema).min(1).max(32),
    crBlocks: integerRangeSchema,
    statblocks: integerRangeSchema,
    monsters: scaledRangeSchema,
    initiativeSlots: scaledRangeSchema,
    mixing: z.enum(['mixed-within-cr-block', 'one-per-cr-block'])
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.roleCombinations.map((roles) =>
      [...roles].sort().join('|')
    )
    if (new Set(keys).size !== keys.length)
      context.addIssue({
        code: 'custom',
        path: ['roleCombinations'],
        message: 'Role combinations must be unique.'
      })
    const complexity = maximumCompositionComplexity(value)
    if (complexity.count > maximumGeneratorCandidateCount)
      context.addIssue({
        code: 'custom',
        path: ['roleCombinations'],
        message: `Party level ${complexity.partyLevel} produces ${complexity.count} candidates; maximum is ${maximumGeneratorCandidateCount}.`
      })
  })

const generationDefaultsSchema = z
  .object({
    difficulty: z.enum([
      'weighted',
      'trivial',
      'easy',
      'medium',
      'hard',
      'deadly'
    ]),
    amount: z.enum(['neutral', 'few', 'standard', 'many']),
    balance: z.enum(['neutral', 'even', 'varied']),
    diversity: z.enum(['neutral', 'low', 'high'])
  })
  .strict()

export const generatorConfigSchema = z
  .object({
    composition: compositionConfigSchema,
    generationDefaults: generationDefaultsSchema,
    scene: z.object({ difficultyWeights: difficultyWeightsSchema }).strict(),
    combat: z
      .object({ mobThreshold: z.number().int().nonnegative().max(999) })
      .strict()
  })
  .strict()

export type GeneratorPresetConfigV3 = z.infer<typeof generatorConfigSchema>
export type GeneratorCompositionConfig = GeneratorPresetConfigV3['composition']
export type ResolvedGeneratorTuning =
  GeneratorPresetConfigV3['generationDefaults']

export const generatorPresetSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    schemaVersion: z.literal(generatorPresetSchemaVersion),
    revision: z.number().int().nonnegative(),
    protected: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    config: generatorConfigSchema
  })
  .strict()
export type GeneratorPreset = z.infer<typeof generatorPresetSchema>

export const generatorPresetRegistrySchema = z
  .object({
    revision: z.number().int().nonnegative(),
    presets: z.array(generatorPresetSchema)
  })
  .strict()
export type GeneratorPresetRegistry = z.infer<
  typeof generatorPresetRegistrySchema
>

export const generatorPresetAssignmentProjectionSchema = z
  .object({
    campaignId: z.uuid(),
    assignedPresetId: z.uuid().nullable(),
    effectivePresetId: z.uuid()
  })
  .strict()
export type GeneratorPresetAssignmentProjection = z.infer<
  typeof generatorPresetAssignmentProjectionSchema
>

export const generatorPresetEditorSnapshotSchema = z
  .object({
    registry: generatorPresetRegistrySchema,
    assignment: generatorPresetAssignmentProjectionSchema.nullable()
  })
  .strict()
export type GeneratorPresetEditorSnapshot = z.infer<
  typeof generatorPresetEditorSnapshotSchema
>

const commandBaseSchema = z
  .object({
    commandId: z.uuid(),
    expectedRegistryRevision: z.number().int().nonnegative()
  })
  .strict()

export const generatorPresetReadEditorInputSchema = z
  .object({ campaignId: z.uuid().nullable() })
  .strict()
export const generatorPresetCreateInputSchema = commandBaseSchema
  .extend({
    name: z.string().trim().min(1).max(100),
    config: generatorConfigSchema
  })
  .strict()
export const generatorPresetUpdateInputSchema = generatorPresetCreateInputSchema
  .extend({ id: z.uuid() })
  .strict()
export const generatorPresetDeleteInputSchema = commandBaseSchema
  .extend({ id: z.uuid() })
  .strict()
export const generatorPresetAssignInputSchema = commandBaseSchema
  .extend({ campaignId: z.uuid(), presetId: z.uuid().nullable() })
  .strict()
export const generatorPresetCommandReceiptInputSchema = z
  .object({ commandId: z.uuid() })
  .strict()

const receiptBase = {
  commandId: z.uuid(),
  registry: generatorPresetRegistrySchema
} as const
export const createGeneratorPresetReceiptSchema = z
  .object({
    ...receiptBase,
    kind: z.literal('created'),
    saved: generatorPresetSchema
  })
  .strict()
export const updateGeneratorPresetReceiptSchema = z
  .object({
    ...receiptBase,
    kind: z.literal('updated'),
    saved: generatorPresetSchema
  })
  .strict()
export const deleteGeneratorPresetReceiptSchema = z
  .object({
    ...receiptBase,
    kind: z.literal('deleted'),
    deletedId: z.uuid(),
    affectedCampaignIds: z.array(z.uuid())
  })
  .strict()
export const assignGeneratorPresetReceiptSchema = z
  .object({
    ...receiptBase,
    kind: z.literal('assigned'),
    assignment: generatorPresetAssignmentProjectionSchema,
    effectivePreset: generatorPresetSchema
  })
  .strict()
export const generatorPresetCommandReceiptSchema = z.discriminatedUnion(
  'kind',
  [
    createGeneratorPresetReceiptSchema,
    updateGeneratorPresetReceiptSchema,
    deleteGeneratorPresetReceiptSchema,
    assignGeneratorPresetReceiptSchema
  ]
)

export type CreateGeneratorPresetCommand = z.infer<
  typeof generatorPresetCreateInputSchema
>
export type UpdateGeneratorPresetCommand = z.infer<
  typeof generatorPresetUpdateInputSchema
>
export type DeleteGeneratorPresetCommand = z.infer<
  typeof generatorPresetDeleteInputSchema
>
export type AssignGeneratorPresetCommand = z.infer<
  typeof generatorPresetAssignInputSchema
>
export type CreateGeneratorPresetReceipt = z.infer<
  typeof createGeneratorPresetReceiptSchema
>
export type UpdateGeneratorPresetReceipt = z.infer<
  typeof updateGeneratorPresetReceiptSchema
>
export type DeleteGeneratorPresetReceipt = z.infer<
  typeof deleteGeneratorPresetReceiptSchema
>
export type AssignGeneratorPresetReceipt = z.infer<
  typeof assignGeneratorPresetReceiptSchema
>
export type GeneratorPresetCommandReceipt = z.infer<
  typeof generatorPresetCommandReceiptSchema
>
