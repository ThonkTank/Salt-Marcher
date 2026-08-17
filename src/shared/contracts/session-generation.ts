import { z } from 'zod'
import { rewardXpBasisSchema } from './campaign-rules.js'
import {
  itemDefinitionSchema,
  itemReferenceKey,
  itemReferenceSchema
} from './loot/item-definition.js'

export const SESSION_ENCOUNTER_ENGINE_VERSION = 'encounter-v5' as const
export const REWARD_ENGINE_VERSION = 'reward-v3' as const
export const rewardEngineVersionSchema = z.enum(['reward-v2', 'reward-v3'])
/** @deprecated Use the component engine versions on persisted runs. */
export const SESSION_GENERATION_ENGINE_VERSION =
  SESSION_ENCOUNTER_ENGINE_VERSION

export const sessionGenerationCatalogReferenceSchema = z
  .object({
    catalogVersion: z.string().min(1).max(100),
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict()

export const generationPartyLevelSchema = z
  .object({
    level: z.number().int().min(1).max(20),
    count: z.number().int().nonnegative()
  })
  .strict()

export const generatedMagicCountsSchema = z
  .object({
    Common: z.number().int().nonnegative(),
    Uncommon: z.number().int().nonnegative(),
    Rare: z.number().int().nonnegative(),
    'Very Rare': z.number().int().nonnegative(),
    Legendary: z.number().int().nonnegative()
  })
  .strict()

export const ledgerRewardPartyMemberSchema = z
  .object({
    characterId: z.uuid(),
    currentXp: z.number().int().nonnegative(),
    projectedXp: z.number().int().nonnegative(),
    ledgerRevision: z.number().int().nonnegative(),
    currentNonMagicCp: z.number().int().nonnegative(),
    currentMagic: generatedMagicCountsSchema
  })
  .strict()

export const generatedRewardBasisSchema = z
  .object({
    members: z.array(ledgerRewardPartyMemberSchema).min(1),
    targetGoldCp: z.number().int().nonnegative(),
    currentGoldCp: z.number().int().nonnegative(),
    goldDeficitCp: z.number().int().nonnegative(),
    targetMagic: generatedMagicCountsSchema,
    currentMagic: generatedMagicCountsSchema,
    magicDeficit: generatedMagicCountsSchema
  })
  .strict()

export const groupRewardSourceEntrySchema = z
  .object({
    creatureId: z.string().min(1),
    quantity: z.number().int().nonnegative(),
    deadQuantity: z.number().int().nonnegative()
  })
  .strict()
  .refine((entry) => entry.quantity + entry.deadQuantity > 0, {
    message: 'At least one living or dead creature is required.'
  })

const sessionGenerationEncounterInputObjectSchema = z
  .object({
    party: z.array(generationPartyLevelSchema).min(1),
    ledgerParty: z.array(ledgerRewardPartyMemberSchema).optional(),
    adventureDayFraction: z.string().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/),
    encounterCount: z.number().int().min(1).max(10).optional(),
    seed: z.number().int().nonnegative().safe()
  })
  .strict()

function validateSessionGenerationInput(
  value: Readonly<{
    party: readonly z.infer<typeof generationPartyLevelSchema>[]
    ledgerParty?:
      readonly z.infer<typeof ledgerRewardPartyMemberSchema>[] | undefined
  }>,
  context: z.RefinementCtx
): void {
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
  validateLedgerParty(value.ledgerParty, active, context)
}

export const sessionGenerationEncounterInputSchema =
  sessionGenerationEncounterInputObjectSchema.superRefine(
    validateSessionGenerationInput
  )

export const sessionGenerationRunInputSchema =
  sessionGenerationEncounterInputObjectSchema
    .extend({ ledgerParty: z.array(ledgerRewardPartyMemberSchema).min(1) })
    .superRefine(validateSessionGenerationInput)

const persistedSessionGenerationEncounterInputSchema =
  sessionGenerationEncounterInputObjectSchema.superRefine(
    validateSessionGenerationInput
  )

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

export const generationParametersSchema = z.record(
  z.string().min(1),
  z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
)

export const encounterAuditSchema = z
  .object({
    code: z.enum([
      'encounter_target_sum',
      'candidate_coverage',
      'encounter_selector_fit',
      'deterministic_seed_path',
      'treasure_count',
      'unique_encounter_anchors',
      'treasure_assignment_complete',
      'normal_loot_budget_tolerance',
      'magic_item_count',
      'packing_validity',
      'item_definition_complete',
      'item_value_consistency',
      'container_capacity',
      'coin_denomination_integrity',
      'role_magic_consistency',
      'stock_class_policy'
    ]),
    passed: z.boolean(),
    hard: z.boolean(),
    parameters: generationParametersSchema
  })
  .strict()

export const encounterWarningSchema = z
  .object({
    code: z.enum(['candidate_outside_tolerance', 'constraints_approximated']),
    encounterNumber: z.number().int().positive(),
    parameters: generationParametersSchema
  })
  .strict()

export const encounterConstraintDiagnosticSchema = z
  .object({
    constraint: z.enum(['statblocks', 'monsters', 'initiativeSlots']),
    value: z.number().finite(),
    minimum: z.number().finite(),
    maximum: z.number().finite(),
    normalizedDistance: z.number().nonnegative()
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
    constraintDiagnostics: z.array(encounterConstraintDiagnosticSchema)
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
    parameters: generationParametersSchema
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

export const generatedRewardChannelSchema = z.enum([
  'encounter',
  'quest',
  'environment'
])

export const generatedStockClassSchema = z.enum(['normal', 'overstock'])

export const generatedLootRoleSchema = z.enum([
  'compact_value',
  'complex_value',
  'useful',
  'flavor',
  'magic'
])

export const generatedPackingContainerSchema = z
  .object({
    id: z.string().min(1),
    catalogContainerId: z.string().min(1).nullable(),
    name: z.string().min(1),
    capacity: z.number().nonnegative(),
    position: z.number().int().nonnegative()
  })
  .strict()

export const generatedLootItemSchema = z
  .object({
    id: z.string().min(1),
    treasureId: z.string().min(1),
    itemReference: itemReferenceSchema,
    role: generatedLootRoleSchema,
    quantity: z.number().int().positive(),
    containerId: z.string().min(1).nullable(),
    position: z.number().int().nonnegative()
  })
  .strict()

export const generatedTreasureSchema = z
  .object({
    id: z.string().min(1),
    stockClass: generatedStockClassSchema,
    rewardChannel: generatedRewardChannelSchema,
    anchorEncounterNumber: z.number().int().positive().nullable(),
    themeId: z.string().min(1),
    theme: z.string().min(1),
    targetValueCp: z.string().regex(/^-?[0-9]+(?:\.[0-9]+)?$/),
    actualValueCp: z.number().int().nonnegative(),
    items: z.array(generatedLootItemSchema).min(1),
    containers: z.array(generatedPackingContainerSchema)
  })
  .strict()

const sessionGeneratedRunObjectSchema = z
  .object({
    runKind: z.literal('session').default('session'),
    id: z.uuid(),
    originFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    generatedAt: z.iso.datetime(),
    engineVersion: z.literal(SESSION_GENERATION_ENGINE_VERSION),
    rewardEngineVersion: z
      .literal(REWARD_ENGINE_VERSION)
      .default(REWARD_ENGINE_VERSION),
    catalogVersion: z.string().min(1),
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    generatorPreset: z
      .object({
        id: z.uuid(),
        revision: z.number().int().nonnegative(),
        configHash: z.string().regex(/^[0-9a-f]{64}$/)
      })
      .strict(),
    input: sessionGenerationRunInputSchema,
    session: sessionGenerationEncounterSuccessSchema.shape.session.extend({
      goldBudgetCp: z.number().int().nonnegative(),
      normalTreasureCount: z.number().int().nonnegative(),
      overstockTreasureCount: z.number().int().min(0).max(1),
      magicTargets: generatedMagicCountsSchema
    }),
    rewardBasis: generatedRewardBasisSchema.nullable().default(null),
    encounters: z.array(encounterIntentSchema).min(1),
    itemDefinitions: z.array(itemDefinitionSchema),
    treasures: z.array(generatedTreasureSchema),
    rewardSummary: z
      .object({
        normalValueCp: z.number().int().nonnegative(),
        overstockValueCp: z.number().int().nonnegative(),
        magicCount: z.number().int().nonnegative()
      })
      .strict(),
    warnings: z.array(encounterWarningSchema),
    audits: z.array(encounterAuditSchema)
  })
  .strict()

export const sessionGeneratedRunSchema =
  sessionGeneratedRunObjectSchema.superRefine(validateGeneratedItemDefinitions)

export const persistedSessionGeneratedRunSchema =
  sessionGeneratedRunObjectSchema
    .extend({
      rewardEngineVersion: rewardEngineVersionSchema.default('reward-v2'),
      input: persistedSessionGenerationEncounterInputSchema
    })
    .superRefine(validateGeneratedItemDefinitions)

const groupRewardGenerationInputObjectSchema = z
  .object({
    party: z.array(generationPartyLevelSchema).min(1),
    ledgerParty: z.array(ledgerRewardPartyMemberSchema).min(1),
    sceneId: z.uuid(),
    groupId: z.uuid(),
    sceneRevision: z.number().int().nonnegative(),
    groupRevision: z.number().int().nonnegative().nullable(),
    groupEntries: z.array(groupRewardSourceEntrySchema).min(1),
    partyRevision: z.number().int().nonnegative(),
    campaignRulesRevision: z.number().int().nonnegative(),
    rewardXpBasis: rewardXpBasisSchema,
    baseXp: z.number().int().nonnegative(),
    adjustedXp: z.number().int().nonnegative(),
    rewardXp: z.number().int().nonnegative(),
    seed: z.number().int().nonnegative().safe()
  })
  .strict()

export const groupRewardGenerationInputSchema =
  groupRewardGenerationInputObjectSchema.superRefine((value, context) => {
    const creatureIds = new Set<string>()
    for (const [index, entry] of value.groupEntries.entries()) {
      if (creatureIds.has(entry.creatureId))
        context.addIssue({
          code: 'custom',
          path: ['groupEntries', index, 'creatureId'],
          message: 'Group reward creature identities must be unique.'
        })
      creatureIds.add(entry.creatureId)
    }
    validateLedgerParty(
      value.ledgerParty,
      value.party.reduce((sum, entry) => sum + entry.count, 0),
      context
    )
  })

const persistedGroupRewardGenerationInputSchema =
  groupRewardGenerationInputObjectSchema.extend({
    ledgerParty: z.array(ledgerRewardPartyMemberSchema).optional()
  })

const groupRewardGeneratedRunObjectSchema = z
  .object({
    runKind: z.literal('group_reward'),
    id: z.uuid(),
    originFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    generatedAt: z.iso.datetime(),
    rewardEngineVersion: z.literal(REWARD_ENGINE_VERSION),
    catalogVersion: z.string().min(1),
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    generatorPreset: z
      .object({
        id: z.uuid(),
        revision: z.number().int().nonnegative(),
        configHash: z.string().regex(/^[0-9a-f]{64}$/)
      })
      .strict(),
    input: groupRewardGenerationInputSchema,
    rewardBasis: generatedRewardBasisSchema.nullable().default(null),
    goldBudgetCp: z.number().int().nonnegative(),
    magicTargets: generatedMagicCountsSchema,
    itemDefinitions: z.array(itemDefinitionSchema),
    treasures: z.array(generatedTreasureSchema).max(1),
    rewardSummary: z
      .object({
        normalValueCp: z.number().int().nonnegative(),
        overstockValueCp: z.literal(0),
        magicCount: z.number().int().nonnegative()
      })
      .strict(),
    audits: z.array(encounterAuditSchema)
  })
  .strict()

export const groupRewardGeneratedRunSchema =
  groupRewardGeneratedRunObjectSchema.superRefine(
    validateGeneratedItemDefinitions
  )

export const persistedGroupRewardGeneratedRunSchema =
  groupRewardGeneratedRunObjectSchema
    .extend({
      rewardEngineVersion: rewardEngineVersionSchema,
      input: persistedGroupRewardGenerationInputSchema
    })
    .superRefine(validateGeneratedItemDefinitions)

export const generatedRunSchema = z.discriminatedUnion('runKind', [
  persistedSessionGeneratedRunSchema,
  persistedGroupRewardGeneratedRunSchema
])

export const sessionGenerationRunSuccessSchema = z
  .object({ status: z.literal('success'), run: sessionGeneratedRunSchema })
  .strict()

export const sessionGenerationRunResultSchema = z.discriminatedUnion('status', [
  sessionGenerationRunSuccessSchema,
  sessionGenerationEncounterFailureSchema
])

export const generatedRunIdInputSchema = z.object({ runId: z.uuid() }).strict()

function validateGeneratedItemDefinitions(
  run: Readonly<{
    id: string
    itemDefinitions: readonly z.infer<typeof itemDefinitionSchema>[]
    treasures: readonly z.infer<typeof generatedTreasureSchema>[]
  }>,
  context: z.RefinementCtx
): void {
  const definitions = new Map<string, number>()
  run.itemDefinitions.forEach((definition, index) => {
    const reference = definition.reference
    if (reference.kind !== 'generated' || reference.runId !== run.id)
      context.addIssue({
        code: 'custom',
        path: ['itemDefinitions', index, 'reference'],
        message: 'Run definitions must be owned by this generated run.'
      })
    const key = itemReferenceKey(reference)
    if (definitions.has(key))
      context.addIssue({
        code: 'custom',
        path: ['itemDefinitions', index, 'reference'],
        message: 'Generated item definition references must be unique.'
      })
    definitions.set(key, index)
  })
  const used = new Set<string>()
  run.treasures.forEach((treasure, treasureIndex) =>
    treasure.items.forEach((item, itemIndex) => {
      const key = itemReferenceKey(item.itemReference)
      if (!definitions.has(key))
        context.addIssue({
          code: 'custom',
          path: [
            'treasures',
            treasureIndex,
            'items',
            itemIndex,
            'itemReference'
          ],
          message: 'Generated item line must reference one run definition.'
        })
      used.add(key)
    })
  )
  run.itemDefinitions.forEach((definition, index) => {
    if (!used.has(itemReferenceKey(definition.reference)))
      context.addIssue({
        code: 'custom',
        path: ['itemDefinitions', index],
        message: 'Generated item definitions must be referenced by a line.'
      })
  })
}

export type SessionGenerationEncounterInput = Readonly<
  z.infer<typeof sessionGenerationEncounterInputSchema>
>
export type SessionGenerationRunInput = Readonly<
  z.infer<typeof sessionGenerationRunInputSchema>
>
export type SessionGenerationCatalogReference = Readonly<
  z.infer<typeof sessionGenerationCatalogReferenceSchema>
>
export type EncounterIntent = Readonly<z.infer<typeof encounterIntentSchema>>
export type EncounterAudit = Readonly<z.infer<typeof encounterAuditSchema>>
export type EncounterWarning = Readonly<z.infer<typeof encounterWarningSchema>>
export type SessionGenerationEncounterFailure = Readonly<
  z.infer<typeof sessionGenerationEncounterFailureSchema>
>
export type SessionGenerationEncounterSuccess = Readonly<
  z.infer<typeof sessionGenerationEncounterSuccessSchema>
>
export type SessionGenerationEncounterResult = Readonly<
  z.infer<typeof sessionGenerationEncounterResultSchema>
>
export type SessionGenerationIssue = Readonly<
  z.infer<typeof sessionGenerationIssueSchema>
>
export type GeneratedLootItem = Readonly<
  z.infer<typeof generatedLootItemSchema>
>
export type GeneratedItemDefinition = Readonly<
  z.infer<typeof itemDefinitionSchema>
>
export type GeneratedTreasure = Readonly<
  z.infer<typeof generatedTreasureSchema>
>
export type GeneratedRun = Readonly<z.infer<typeof generatedRunSchema>>
export type SessionGeneratedRun = Readonly<
  z.infer<typeof sessionGeneratedRunSchema>
>
export type PersistedSessionGeneratedRun = Readonly<
  z.infer<typeof persistedSessionGeneratedRunSchema>
>
export type GroupRewardGeneratedRun = Readonly<
  z.infer<typeof groupRewardGeneratedRunSchema>
>
export type PersistedGroupRewardGeneratedRun = Readonly<
  z.infer<typeof persistedGroupRewardGeneratedRunSchema>
>
export type GroupRewardGenerationInput = Readonly<
  z.infer<typeof groupRewardGenerationInputSchema>
>
export type LedgerRewardPartyMember = Readonly<
  z.infer<typeof ledgerRewardPartyMemberSchema>
>
export type GeneratedRewardBasis = Readonly<
  z.infer<typeof generatedRewardBasisSchema>
>
export type SessionGenerationRunResult = Readonly<
  z.infer<typeof sessionGenerationRunResultSchema>
>

function validateLedgerParty(
  members: readonly { characterId: string }[] | undefined,
  partyCount: number,
  context: z.RefinementCtx
): void {
  if (!members) return
  if (members.length !== partyCount)
    context.addIssue({
      code: 'custom',
      path: ['ledgerParty'],
      message: 'Ledger party must identify every active party member.'
    })
  if (
    new Set(members.map((member) => member.characterId)).size !== members.length
  )
    context.addIssue({
      code: 'custom',
      path: ['ledgerParty'],
      message: 'Ledger party character identities must be unique.'
    })
}
