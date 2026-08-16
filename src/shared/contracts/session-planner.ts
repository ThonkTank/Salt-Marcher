import { z } from 'zod'
import { savedEncounterPlanSummarySchema } from './encounter-plans.js'
import { itemDefinitionSchema, treasureSchema } from './loot.js'
import { generatedTreasureSchema } from './session-generation.js'

const fractionSchema = z.string().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/)

export const sessionPlannerManualLootNoteSchema = z
  .object({
    id: z.uuid(),
    text: z.string().trim().min(1).max(2_000),
    position: z.number().int().nonnegative()
  })
  .strict()

export const sessionPlannerGeneratedRewardReferenceSchema = z
  .object({
    runId: z.uuid(),
    generatedTreasureId: z.string().min(1),
    rewardChannel: z.enum(['encounter', 'quest', 'environment']),
    anchorEncounterNumber: z.number().int().positive().nullable(),
    treasureOrdinal: z.number().int().positive(),
    position: z.number().int().nonnegative()
  })
  .strict()

export const sessionPlannerSceneTitleKindSchema = z.enum([
  'authored',
  'generated_encounter',
  'generated_quest_rewards',
  'generated_environment_rewards'
])

const sessionPlannerSceneObjectSchema = z
  .object({
    id: z.uuid(),
    titleKind: sessionPlannerSceneTitleKindSchema.default('authored'),
    title: z.string().trim().min(1).max(200).nullable(),
    notes: z.string().max(10_000),
    locationId: z.uuid().nullable(),
    encounterPlanId: z.uuid().nullable(),
    allocatedXp: z.number().int().nonnegative(),
    position: z.number().int().nonnegative(),
    restAfter: z.enum(['short', 'long']).nullable(),
    manualLootNotes: z.array(sessionPlannerManualLootNoteSchema),
    generatedRewards: z.array(sessionPlannerGeneratedRewardReferenceSchema)
  })
  .strict()

function validateSceneTitle(
  scene: z.infer<typeof sessionPlannerSceneObjectSchema>,
  context: z.RefinementCtx
) {
  if (scene.titleKind === 'authored' && scene.title === null)
    context.addIssue({
      code: 'custom',
      path: ['title'],
      message: 'Authored scenes require a title.'
    })
  if (scene.titleKind !== 'authored' && scene.title !== null)
    context.addIssue({
      code: 'custom',
      path: ['title'],
      message: 'Generated scene titles cannot store authored text.'
    })
}

export const sessionPlannerSceneSchema =
  sessionPlannerSceneObjectSchema.superRefine(validateSceneTitle)

const sessionPlannerSessionObjectSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(200),
    participantIds: z.array(z.uuid()),
    adventureDayFraction: fractionSchema,
    encounterCount: z.number().int().min(1).max(10).nullable(),
    selectedSceneId: z.uuid().nullable(),
    scenes: z.array(sessionPlannerSceneSchema)
  })
  .strict()

export const sessionPlannerSessionSchema =
  sessionPlannerSessionObjectSchema.superRefine(validateSession)

export const sessionPlannerSceneDraftSchema = sessionPlannerSceneObjectSchema
  .omit({ position: true })
  .extend({
    position: z.number().int().nonnegative()
  })

export const saveSessionPlanInputSchema = z
  .object({
    sessionId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    participantIds: z.array(z.uuid()),
    adventureDayFraction: fractionSchema,
    encounterCount: z.number().int().min(1).max(10).nullable(),
    selectedSceneId: z.uuid().nullable(),
    scenes: z.array(sessionPlannerSceneSchema)
  })
  .strict()
  .superRefine((value, context) => validateSession(value, context))

export const sessionPlannerCatalogSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    revision: z.number().int().nonnegative()
  })
  .strict()

export const sessionPlannerEncounterProjectionSchema = z.discriminatedUnion(
  'status',
  [
    z
      .object({
        status: z.literal('ready'),
        summary: savedEncounterPlanSummarySchema
      })
      .strict(),
    z.object({ status: z.enum(['missing', 'unavailable']) }).strict()
  ]
)

export const sessionPlannerGeneratedRewardProjectionSchema = z
  .object({
    runId: z.uuid(),
    generatedTreasureId: z.string().min(1),
    rewardChannel: z.enum(['encounter', 'quest', 'environment']),
    anchorEncounterNumber: z.number().int().positive().nullable(),
    treasureOrdinal: z.number().int().positive(),
    position: z.number().int().nonnegative(),
    status: z.enum(['ready', 'missing']),
    itemDefinitions: z.array(itemDefinitionSchema),
    generatedTreasure: generatedTreasureSchema.nullable(),
    placedTreasure: treasureSchema.nullable()
  })
  .strict()

export const sessionPlannerSceneProjectionSchema =
  sessionPlannerSceneObjectSchema
    .omit({ generatedRewards: true })
    .extend({
      locationLabel: z.string().min(1).nullable(),
      encounter: sessionPlannerEncounterProjectionSchema.nullable(),
      generatedRewards: z.array(sessionPlannerGeneratedRewardProjectionSchema)
    })
    .strict()
    .superRefine(validateSceneTitle)

export const sessionPlannerWorkspaceSchema = z
  .object({
    currentSessionId: z.uuid(),
    sessions: z.array(sessionPlannerCatalogSummarySchema).min(1),
    session: sessionPlannerSessionObjectSchema
      .omit({ scenes: true })
      .extend({ scenes: z.array(sessionPlannerSceneProjectionSchema) }),
    availableParticipants: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string().min(1),
          level: z.number().int().min(1).max(20).nullable(),
          fullDayXp: z.number().int().nonnegative().nullable(),
          partyMember: z.boolean()
        })
        .strict()
    ),
    availableLocations: z.array(
      z.object({ id: z.uuid(), label: z.string().min(1) }).strict()
    ),
    preparation: z.lazy(() => sessionPreparationReceiptSchema).nullable(),
    budget: z
      .object({
        xpBudget: z.number().int().nonnegative(),
        plannedXp: z.number().int().nonnegative(),
        remainingXp: z.number().int(),
        recommendedShortRests: z.number().int().nonnegative(),
        recommendedLongRests: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict()

export const createSessionPlanInputSchema = z
  .object({ name: z.string().trim().min(1).max(200) })
  .strict()
export const openSessionPlanInputSchema = z
  .object({ sessionId: z.uuid() })
  .strict()
export const switchSessionPlanInputSchema = z
  .object({
    targetSessionId: z.uuid(),
    source: saveSessionPlanInputSchema
  })
  .strict()
  .superRefine((value, context) => {
    if (value.targetSessionId === value.source.sessionId)
      context.addIssue({
        code: 'custom',
        path: ['targetSessionId'],
        message: 'Target session must differ from the source session.'
      })
  })
export const renameSessionPlanInputSchema = z
  .object({
    sessionId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(200)
  })
  .strict()
export const deleteSessionPlanInputSchema = z
  .object({
    sessionId: z.uuid(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const startSessionPreparationInputSchema = z
  .object({
    operationId: z.uuid(),
    sessionId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    seed: z.number().int().nonnegative().safe(),
    confirmedReplacement: z.boolean()
  })
  .strict()

export const sessionPreparationStatusSchema = z.enum([
  'queued',
  'generating',
  'resolving_encounters',
  'saving',
  'succeeded',
  'invalid',
  'stale',
  'failed',
  'canceled'
])

const preparationParameterSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
])

export const sessionPreparationFailureSchema = z
  .object({
    stage: z.enum(['validation', 'generation', 'encounter_import', 'saving']),
    code: z.string().min(1),
    retryable: z.boolean(),
    parameters: z.record(z.string(), preparationParameterSchema)
  })
  .strict()

export const sessionPreparationReceiptSchema = z
  .object({
    operationId: z.uuid(),
    sessionId: z.uuid(),
    status: sessionPreparationStatusSchema,
    seed: z.number().int().nonnegative().safe(),
    runId: z.uuid().nullable(),
    encounterBatchFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    cancelRequested: z.boolean(),
    committedPlannerRevision: z.number().int().nonnegative().nullable(),
    failure: sessionPreparationFailureSchema.nullable(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export const startSessionPreparationResultSchema = z.discriminatedUnion(
  'status',
  [
    z
      .object({
        status: z.literal('confirmation_required'),
        operationId: z.uuid(),
        code: z.literal('planner_replace_existing'),
        parameters: z
          .object({ sceneCount: z.number().int().positive() })
          .strict()
      })
      .strict(),
    z
      .object({
        status: z.literal('accepted'),
        receipt: sessionPreparationReceiptSchema
      })
      .strict()
  ]
)

export const sessionPreparationReceiptInputSchema = z
  .object({ operationId: z.uuid() })
  .strict()

export const sessionPreparationReceiptResultSchema = z
  .object({ receipt: sessionPreparationReceiptSchema.nullable() })
  .strict()

export const cancelSessionPreparationResultSchema = z
  .object({ receipt: sessionPreparationReceiptSchema })
  .strict()

export const sessionPreparationChangeNoticeSchema = z
  .object({
    campaignId: z.uuid(),
    operationId: z.uuid(),
    status: sessionPreparationStatusSchema
  })
  .strict()
  .readonly()

export type SessionPlannerScene = Readonly<
  z.infer<typeof sessionPlannerSceneSchema>
>
export type SessionPlannerSession = Readonly<
  z.infer<typeof sessionPlannerSessionSchema>
>
export type SaveSessionPlanInput = Readonly<
  z.infer<typeof saveSessionPlanInputSchema>
>
export type SwitchSessionPlanInput = Readonly<
  z.infer<typeof switchSessionPlanInputSchema>
>
export type SessionPlannerWorkspace = Readonly<
  z.infer<typeof sessionPlannerWorkspaceSchema>
>
export type StartSessionPreparationInput = Readonly<
  z.infer<typeof startSessionPreparationInputSchema>
>
export type StartSessionPreparationResult = Readonly<
  z.infer<typeof startSessionPreparationResultSchema>
>
export type SessionPreparationReceipt = Readonly<
  z.infer<typeof sessionPreparationReceiptSchema>
>
export type SessionPreparationChangeNotice = Readonly<
  z.infer<typeof sessionPreparationChangeNoticeSchema>
>

function validateSession(
  value: {
    participantIds: readonly string[]
    selectedSceneId: string | null
    scenes: readonly {
      id: string
      position: number
      restAfter: 'short' | 'long' | null
      manualLootNotes: readonly { id: string; position: number }[]
      generatedRewards: readonly {
        runId: string
        generatedTreasureId: string
        position: number
      }[]
    }[]
  },
  context: z.RefinementCtx
): void {
  if (new Set(value.participantIds).size !== value.participantIds.length)
    context.addIssue({
      code: 'custom',
      path: ['participantIds'],
      message: 'Participant identities must be unique.'
    })
  if (
    value.scenes.some((scene, position) => scene.position !== position) ||
    new Set(value.scenes.map((scene) => scene.id)).size !== value.scenes.length
  )
    context.addIssue({
      code: 'custom',
      path: ['scenes'],
      message: 'Scene order and identities must be unique and contiguous.'
    })
  if (
    value.selectedSceneId !== null &&
    !value.scenes.some((scene) => scene.id === value.selectedSceneId)
  )
    context.addIssue({
      code: 'custom',
      path: ['selectedSceneId'],
      message: 'Selected scene must belong to the session.'
    })
  const rewardKeys = value.scenes.flatMap((scene) =>
    scene.generatedRewards.map(
      (reward) => `${reward.runId}\u0000${reward.generatedTreasureId}`
    )
  )
  if (new Set(rewardKeys).size !== rewardKeys.length)
    context.addIssue({
      code: 'custom',
      path: ['scenes'],
      message: 'A generated reward can belong to only one session scene.'
    })
  value.scenes.forEach((scene, scenePosition) => {
    if (scenePosition === value.scenes.length - 1 && scene.restAfter !== null)
      context.addIssue({
        code: 'custom',
        path: ['scenes', scenePosition, 'restAfter'],
        message: 'A rest must be between two scenes.'
      })
    if (
      scene.manualLootNotes.some(
        (note, position) => note.position !== position
      ) ||
      new Set(scene.manualLootNotes.map((note) => note.id)).size !==
        scene.manualLootNotes.length
    )
      context.addIssue({
        code: 'custom',
        path: ['scenes', scenePosition, 'manualLootNotes'],
        message: 'Manual loot notes must be uniquely and contiguously ordered.'
      })
    if (
      scene.generatedRewards.some(
        (reward, position) => reward.position !== position
      ) ||
      new Set(
        scene.generatedRewards.map(
          (reward) => `${reward.runId}\u0000${reward.generatedTreasureId}`
        )
      ).size !== scene.generatedRewards.length
    )
      context.addIssue({
        code: 'custom',
        path: ['scenes', scenePosition, 'generatedRewards'],
        message: 'Generated rewards must be uniquely and contiguously ordered.'
      })
  })
}
