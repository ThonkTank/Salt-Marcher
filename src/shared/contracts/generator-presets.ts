import { z } from 'zod'
import { encounterTuningSchema } from './encounter-tuning.js'

export const generatorPresetSchemaVersion = 1 as const
export const systemGeneratorPresetId = '00000000-0000-0000-0000-000000000001'

const countSchema = z
  .object({
    few: z.number().int().min(1).max(999),
    standard: z.number().int().min(1).max(999),
    many: z.number().int().min(1).max(999)
  })
  .strict()

export const generatorConfigSchema = z
  .object({
    tuning: encounterTuningSchema,
    autoDifficulty: z.enum(['easy', 'medium', 'hard', 'deadly']),
    upperBandMultiplier: z.number().min(1).max(3),
    maxCounts: countSchema,
    desiredCounts: countSchema,
    rankedPoolSize: z.number().int().min(1).max(200),
    diversePoolSize: z.number().int().min(1).max(200),
    topOptionCount: z.number().int().min(1).max(100),
    maxCombinationSize: z.number().int().min(1).max(3),
    amountPenaltyWeight: z.number().min(0).max(10),
    diversityPenaltyWeight: z.number().min(0).max(10),
    balancePenaltyWeight: z.number().min(0).max(10),
    allowBestEffort: z.boolean()
  })
  .strict()

export type GeneratorConfig = z.infer<typeof generatorConfigSchema>

export const defaultGeneratorConfig: GeneratorConfig = {
  tuning: {
    difficulty: 'auto',
    amount: 'standard',
    balance: 'auto',
    diversity: 'auto'
  },
  autoDifficulty: 'medium',
  upperBandMultiplier: 1.35,
  maxCounts: { few: 3, standard: 6, many: 10 },
  desiredCounts: { few: 2, standard: 4, many: 8 },
  rankedPoolSize: 24,
  diversePoolSize: 12,
  topOptionCount: 5,
  maxCombinationSize: 3,
  amountPenaltyWeight: 0.02,
  diversityPenaltyWeight: 0.08,
  balancePenaltyWeight: 0.08,
  allowBestEffort: true
}

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

export const generatorPresetAssignmentSchema = z
  .object({ campaignId: z.uuid(), presetId: z.uuid() })
  .strict()
export const generatorPresetSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    presets: z.array(generatorPresetSchema),
    assignments: z.array(generatorPresetAssignmentSchema),
    activeCampaignId: z.uuid().nullable(),
    activePresetId: z.uuid().nullable()
  })
  .strict()
export type GeneratorPresetSnapshot = z.infer<
  typeof generatorPresetSnapshotSchema
>

export const generatorPresetCreateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    config: generatorConfigSchema,
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()
export const generatorPresetUpdateInputSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    config: generatorConfigSchema,
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()
export const generatorPresetDeleteInputSchema = z
  .object({ id: z.uuid(), expectedRevision: z.number().int().nonnegative() })
  .strict()
export const generatorPresetAssignInputSchema = z
  .object({
    campaignId: z.uuid(),
    presetId: z.uuid().nullable(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()
