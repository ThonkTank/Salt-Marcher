import { z } from 'zod'
import { creatureCatalogQuerySchema } from './encounter.js'
import { encounterTuningSchema } from './encounter-tuning.js'

export const sceneGroupEntrySchema = z
  .object({
    id: z.uuid(),
    creatureId: z.string().min(1),
    displayName: z.string().min(1),
    quantity: z.number().int().positive(),
    position: z.number().int().nonnegative(),
    available: z.boolean()
  })
  .strict()

export const sceneGroupDispositionSchema = z.enum([
  'hostile',
  'neutral',
  'allied'
])

export const sceneGroupSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(100),
    note: z.string().max(1_000),
    disposition: sceneGroupDispositionSchema,
    archived: z.boolean(),
    baseXp: z.number().int().nonnegative(),
    position: z.number().int().nonnegative(),
    entries: z.array(sceneGroupEntrySchema)
  })
  .strict()

export const runningSceneSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(100),
    defaultScene: z.boolean(),
    focused: z.boolean(),
    locationId: z.string().nullable(),
    locationName: z.string(),
    gameTimeSeconds: z.number().int().nonnegative(),
    partyMemberIds: z.array(z.uuid()),
    groups: z.array(sceneGroupSchema)
  })
  .strict()

export const sceneLocationChoiceSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100)
  })
  .strict()

export const sceneSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    defaultSceneId: z.uuid(),
    focusedSceneId: z.uuid(),
    scenes: z.array(runningSceneSchema).min(1),
    locationChoices: z.array(sceneLocationChoiceSchema),
    unassignedPartyMemberIds: z.array(z.uuid())
  })
  .strict()

export const sceneGroupDraftEntrySchema = z
  .object({
    creatureId: z.string().min(1),
    quantity: z.number().int().positive().max(999)
  })
  .strict()

const groupEntriesInputSchema = z.array(sceneGroupDraftEntrySchema)

export const saveSceneGroupInputSchema = z
  .object({
    sceneId: z.uuid(),
    groupId: z.uuid().nullable(),
    name: z.string().trim().min(1).max(100),
    note: z.string().trim().max(1_000),
    disposition: sceneGroupDispositionSchema,
    entries: groupEntriesInputSchema,
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const deleteSceneGroupInputSchema = z
  .object({
    sceneId: z.uuid(),
    groupId: z.uuid(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const setSceneGroupArchivedInputSchema = z
  .object({
    sceneId: z.uuid(),
    groupId: z.uuid(),
    archived: z.boolean(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const assignScenePartyInputSchema = z
  .object({
    sceneId: z.uuid(),
    partyMemberId: z.uuid(),
    assigned: z.boolean(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const focusSceneInputSchema = z
  .object({
    sceneId: z.uuid(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const setSceneLocationInputSchema = z
  .object({
    sceneId: z.uuid(),
    locationId: z.uuid().nullable(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const groupGenerationModeSchema = z.enum(['fill', 'replace'])

export const sceneGroupDraftGenerationRequestSchema = z
  .object({
    sceneId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    entries: z.array(sceneGroupDraftEntrySchema),
    mode: groupGenerationModeSchema,
    filters: creatureCatalogQuerySchema,
    tuning: encounterTuningSchema,
    seed: z.number().int().nonnegative()
  })
  .strict()

export const evaluateSceneGroupDraftInputSchema = z
  .object({
    sceneId: z.uuid(),
    entries: z.array(sceneGroupDraftEntrySchema),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const sceneGroupDraftEvaluationSchema = z
  .object({
    sceneId: z.uuid(),
    partySize: z.number().int().nonnegative(),
    creatureCount: z.number().int().nonnegative(),
    partyThresholds: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative()
    ]),
    baseXp: z.number().int().nonnegative(),
    adjustedXp: z.number().int().nonnegative(),
    multiplier: z.number().positive(),
    difficultyBand: z.enum([
      'trivial',
      'easy',
      'medium',
      'hard',
      'deadly',
      'unavailable'
    ]),
    difficultyLabel: z.string(),
    canStart: z.boolean(),
    message: z.string()
  })
  .strict()

export const encounterSelectionEvaluationSchema =
  sceneGroupDraftEvaluationSchema
    .extend({ selectedGroupIds: z.array(z.uuid()) })
    .strict()

export const evaluateEncounterSelectionInputSchema = z
  .object({
    sceneId: z.uuid(),
    groupIds: z.array(z.uuid()),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const sceneGroupDraftGenerationSchema = z
  .object({
    sceneId: z.uuid(),
    sceneRevision: z.number().int().nonnegative(),
    name: z.string().min(1).max(100),
    entries: z.array(
      z
        .object({
          creatureId: z.string().min(1),
          displayName: z.string().min(1),
          quantity: z.number().int().positive(),
          cr: z.number().nonnegative(),
          xp: z.number().int().nonnegative(),
          available: z.boolean()
        })
        .strict()
    ),
    evaluation: sceneGroupDraftEvaluationSchema,
    context: z
      .object({
        sceneTitle: z.string(),
        locationId: z.string().nullable(),
        locationName: z.string(),
        existingGroupCount: z.number().int().nonnegative(),
        effectiveEncounterTableIds: z.array(z.string()),
        effectiveFactionIds: z.array(z.string()),
        catalogFallback: z.boolean()
      })
      .strict(),
    quality: z.enum(['exact', 'fallback', 'none']),
    message: z.string()
  })
  .strict()

export type SceneGroup = Readonly<z.infer<typeof sceneGroupSchema>>
export type SceneGroupDisposition = z.infer<typeof sceneGroupDispositionSchema>
export type RunningScene = Readonly<z.infer<typeof runningSceneSchema>>
export type SceneSnapshot = Readonly<z.infer<typeof sceneSnapshotSchema>>
export type SceneGroupDraftGeneration = Readonly<
  z.infer<typeof sceneGroupDraftGenerationSchema>
>
export type SceneGroupSuggestion = SceneGroupDraftGeneration
export type SceneGroupDraftEvaluation = Readonly<
  z.infer<typeof sceneGroupDraftEvaluationSchema>
>
export type SceneGroupDraftEntry = Readonly<
  z.infer<typeof sceneGroupDraftEntrySchema>
>
export type GroupGenerationMode = z.infer<typeof groupGenerationModeSchema>
export type EncounterSelectionEvaluation = Readonly<
  z.infer<typeof encounterSelectionEvaluationSchema>
>
