import { z } from 'zod'
import {
  encounterBlockSchema,
  encounterDifficultyBandSchema
} from './session-generation.js'

const fingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/)

export const preparedEncounterCreatureSchema = z
  .object({
    creatureId: z.string().min(1),
    quantity: z.number().int().positive(),
    lastKnownName: z.string().min(1),
    position: z.number().int().nonnegative()
  })
  .strict()

export const preparedEncounterRosterSchema = z
  .object({
    encounterNumber: z.number().int().positive(),
    targetXp: z.number().int().nonnegative(),
    declaredDifficulty: encounterDifficultyBandSchema,
    rosterFingerprint: fingerprintSchema,
    creatures: z.array(preparedEncounterCreatureSchema).min(1),
    totalCreatureCount: z.number().int().positive(),
    baseXp: z.number().int().nonnegative(),
    adjustedXp: z.number().int().nonnegative()
  })
  .strict()

export const prepareGeneratedEncounterBatchCommandSchema = z
  .object({
    runId: z.uuid(),
    engineVersion: z.string().min(1),
    seed: z.number().int().nonnegative().safe(),
    intents: z
      .array(
        z
          .object({
            encounterNumber: z.number().int().positive(),
            targetXp: z.number().int().nonnegative(),
            difficulty: encounterDifficultyBandSchema,
            blocks: z.array(encounterBlockSchema).min(1)
          })
          .strict()
      )
      .min(1)
  })
  .strict()
  .superRefine((value, context) => {
    const numbers = value.intents.map((intent) => intent.encounterNumber)
    if (new Set(numbers).size !== numbers.length)
      context.addIssue({
        code: 'custom',
        path: ['intents'],
        message: 'Encounter numbers must be unique.'
      })
  })

export const preparedGeneratedEncounterBatchSchema = z
  .object({
    runId: z.uuid(),
    engineVersion: z.string().min(1),
    batchFingerprint: fingerprintSchema,
    rosters: z.array(preparedEncounterRosterSchema).min(1)
  })
  .strict()

const generatedBatchFailureSchema = z
  .object({
    status: z.enum([
      'INVALID_REQUEST',
      'UNRESOLVABLE',
      'CONFLICT',
      'STORAGE_FAILURE'
    ]),
    code: z.string().min(1),
    parameters: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
  })
  .strict()

export const preparedGeneratedEncounterBatchResultSchema = z.discriminatedUnion(
  'status',
  [
    z
      .object({
        status: z.literal('SUCCESS'),
        prepared: preparedGeneratedEncounterBatchSchema
      })
      .strict(),
    generatedBatchFailureSchema
  ]
)

export const commitGeneratedEncounterBatchCommandSchema = z
  .object({ prepared: preparedGeneratedEncounterBatchSchema })
  .strict()

export const savedEncounterPlanSummarySchema = z
  .object({
    id: z.uuid(),
    titleKind: z.enum(['authored', 'generated_encounter']),
    authoredName: z.string().min(1).nullable(),
    generatedEncounterNumber: z.number().int().positive().nullable(),
    creatureCount: z.number().int().positive(),
    baseXp: z.number().int().nonnegative(),
    adjustedXp: z.number().int().nonnegative(),
    difficulty: z.enum(['TRIVIAL', 'EASY', 'MEDIUM', 'HARD', 'DEADLY']),
    creatures: z.array(
      z
        .object({
          quantity: z.number().int().positive(),
          name: z.string().min(1)
        })
        .strict()
    )
  })
  .strict()

export const committedGeneratedEncounterMappingSchema = z
  .object({
    encounterNumber: z.number().int().positive(),
    planId: z.uuid(),
    summary: savedEncounterPlanSummarySchema
  })
  .strict()

export const committedGeneratedEncounterBatchResultSchema =
  z.discriminatedUnion('status', [
    z
      .object({
        status: z.literal('SUCCESS'),
        runId: z.uuid(),
        mappings: z.array(committedGeneratedEncounterMappingSchema).min(1)
      })
      .strict(),
    generatedBatchFailureSchema
  ])

export const generatedEncounterPlanSummaryBatchQuerySchema = z
  .object({ planIds: z.array(z.uuid()).min(1).max(100) })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.planIds).size !== value.planIds.length)
      context.addIssue({
        code: 'custom',
        path: ['planIds'],
        message: 'Plan identities must be unique.'
      })
  })

export const generatedEncounterPlanSummaryBatchResultSchema = z
  .object({
    entries: z.array(
      z.discriminatedUnion('status', [
        z
          .object({
            status: z.literal('READY'),
            planId: z.uuid(),
            summary: savedEncounterPlanSummarySchema
          })
          .strict(),
        z
          .object({
            status: z.enum(['MISSING', 'UNAVAILABLE']),
            planId: z.uuid()
          })
          .strict()
      ])
    )
  })
  .strict()

export const searchSavedEncounterPlansQuerySchema = z
  .object({ query: z.string().trim().min(2).max(100) })
  .strict()

export const savedEncounterPlanSearchResultSchema = z
  .object({
    hits: z
      .array(
        z
          .object({
            planId: z.uuid(),
            titleKind: z.enum(['authored', 'generated_encounter']),
            authoredName: z.string().min(1).nullable(),
            generatedEncounterNumber: z.number().int().positive().nullable(),
            creatures: z.array(
              z
                .object({
                  quantity: z.number().int().positive(),
                  name: z.string().min(1)
                })
                .strict()
            )
          })
          .strict()
      )
      .max(8),
    hasMore: z.boolean()
  })
  .strict()

export type PreparedGeneratedEncounterBatch = Readonly<
  z.infer<typeof preparedGeneratedEncounterBatchSchema>
>
export type PrepareGeneratedEncounterBatchCommand = Readonly<
  z.infer<typeof prepareGeneratedEncounterBatchCommandSchema>
>
export type PreparedGeneratedEncounterBatchResult = Readonly<
  z.infer<typeof preparedGeneratedEncounterBatchResultSchema>
>
export type CommitGeneratedEncounterBatchCommand = Readonly<
  z.infer<typeof commitGeneratedEncounterBatchCommandSchema>
>
export type CommittedGeneratedEncounterBatchResult = Readonly<
  z.infer<typeof committedGeneratedEncounterBatchResultSchema>
>
export type SavedEncounterPlanSummary = Readonly<
  z.infer<typeof savedEncounterPlanSummarySchema>
>
export type GeneratedEncounterPlanSummaryBatchResult = Readonly<
  z.infer<typeof generatedEncounterPlanSummaryBatchResultSchema>
>
export type SavedEncounterPlanSearchResult = Readonly<
  z.infer<typeof savedEncounterPlanSearchResultSchema>
>
