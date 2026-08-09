import { z } from 'zod'

export const SESSION_GENERATION_ENGINE_VERSION = 'saltmarcher-v4' as const

export const generationPartyLevelSchema = z
  .object({
    level: z.number().int().min(1).max(20),
    count: z.number().int().nonnegative()
  })
  .strict()

export const sessionGenerationEncounterInputSchema = z
  .object({
    party: z.array(generationPartyLevelSchema).min(1),
    adventureDayFraction: z.string().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/),
    encounterCount: z.number().int().min(1).max(10).optional(),
    seed: z.number().int().nonnegative().safe()
  })
  .strict()
  .superRefine((value, context) => {
    const levels = new Set<number>()
    let active = 0
    for (const entry of value.party) {
      if (levels.has(entry.level))
        context.addIssue({
          code: 'custom',
          path: ['party'],
          message: 'Party levels must be unique.'
        })
      levels.add(entry.level)
      active += entry.count
    }
    if (active < 1)
      context.addIssue({
        code: 'custom',
        path: ['party'],
        message: 'At least one active player is required.'
      })
  })

export const encounterRoleSchema = z.enum([
  'Minion',
  'Support',
  'Standard',
  'Elite',
  'Boss'
])

export const encounterDifficultyBandSchema = z.enum([
  'EASY',
  'MEDIUM',
  'HARD',
  'DEADLY'
])

export const encounterBlockSchema = z
  .object({
    role: encounterRoleSchema,
    challengeRating: z.string().min(1),
    challengeRatingCode: z.number().int(),
    quantity: z.number().int().positive(),
    statblockSlots: z.number().int().positive(),
    unitXp: z.number().int().nonnegative()
  })
  .strict()

export const encounterAuditSchema = z
  .object({
    name: z.string().min(1),
    passed: z.boolean(),
    hard: z.boolean(),
    detail: z.string()
  })
  .strict()

export const encounterWarningSchema = z
  .object({
    code: z.enum(['candidate_outside_tolerance', 'constraints_approximated']),
    encounterNumber: z.number().int().positive(),
    message: z.string()
  })
  .strict()

export const encounterIntentSchema = z
  .object({
    encounterNumber: z.number().int().positive(),
    targetXp: z.number().int().nonnegative(),
    adjustedXp: z.number().int().nonnegative(),
    xpDelta: z.number().int(),
    difficulty: encounterDifficultyBandSchema,
    patternId: z.string().min(1),
    blocks: z.array(encounterBlockSchema).min(1),
    monsterCount: z.number().int().positive(),
    statblockCount: z.number().int().positive(),
    effectiveMonsterCount: z.number().positive(),
    xpMultiplier: z.number().positive(),
    bossinessRank: z.number().int().positive(),
    constraintDiagnostics: z.array(z.string()),
    displaySummary: z.string().min(1).optional()
  })
  .strict()

export const sessionGenerationIssueCodeSchema = z.enum([
  'invalid_party',
  'invalid_fraction',
  'invalid_encounter_count',
  'catalog_unavailable',
  'catalog_schema_invalid',
  'catalog_hash_mismatch',
  'catalog_reference_missing',
  'no_candidate',
  'hard_audit_failed'
])

export const sessionGenerationIssueSchema = z
  .object({
    code: sessionGenerationIssueCodeSchema,
    path: z.array(z.string()).optional(),
    message: z.string().min(1)
  })
  .strict()

export const sessionGenerationEncounterSuccessSchema = z
  .object({
    status: z.literal('success'),
    engineVersion: z.literal(SESSION_GENERATION_ENGINE_VERSION),
    catalogVersion: z.string().min(1),
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    generatorPreset: z
      .object({
        id: z.uuid(),
        revision: z.number().int().nonnegative(),
        configHash: z.string().regex(/^[0-9a-f]{64}$/)
      })
      .strict(),
    input: sessionGenerationEncounterInputSchema,
    session: z
      .object({
        partyCount: z.number().int().positive(),
        dayXpBudget: z.number().int().nonnegative(),
        sessionXpTarget: z.number().int().nonnegative(),
        averageLevel: z.number().min(1).max(20),
        encounterCount: z.number().int().min(1).max(10)
      })
      .strict(),
    encounters: z.array(encounterIntentSchema).min(1),
    warnings: z.array(encounterWarningSchema),
    audits: z.array(encounterAuditSchema)
  })
  .strict()

export const sessionGenerationEncounterFailureSchema = z
  .object({
    status: z.enum(['invalid_input', 'catalog_error', 'unresolvable']),
    issues: z.array(sessionGenerationIssueSchema).min(1)
  })
  .strict()

export const sessionGenerationEncounterResultSchema = z.discriminatedUnion(
  'status',
  [
    sessionGenerationEncounterSuccessSchema,
    sessionGenerationEncounterFailureSchema
  ]
)

export type SessionGenerationEncounterInput = Readonly<
  z.infer<typeof sessionGenerationEncounterInputSchema>
>
export type EncounterIntent = Readonly<z.infer<typeof encounterIntentSchema>>
export type SessionGenerationEncounterSuccess = Readonly<
  z.infer<typeof sessionGenerationEncounterSuccessSchema>
>
export type SessionGenerationEncounterResult = Readonly<
  z.infer<typeof sessionGenerationEncounterResultSchema>
>
export type SessionGenerationIssue = Readonly<
  z.infer<typeof sessionGenerationIssueSchema>
>
