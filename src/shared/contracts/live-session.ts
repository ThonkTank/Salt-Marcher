import { z } from 'zod'
import { partyCharacterSchema, partySnapshotSchema } from './party.js'
import { sceneGroupSchema, sceneSnapshotSchema } from './scene.js'
import { hexTravelSnapshotSchema } from './hex.js'
import {
  combatConditionSchema,
  combatConditions,
  exhaustionLevelSchema,
  type CombatCondition
} from './combat-status.js'

export { partyCharacterSchema as partyMemberSchema, partySnapshotSchema }
export { combatConditionSchema, combatConditions }

export const initiativeRowSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.enum(['party', 'monster']),
    initiative: z.number().int().min(-10).max(40)
  })
  .strict()

export const combatCardSchema = z
  .object({
    id: z.string().min(1),
    creatureId: z.string().min(1).nullable(),
    memberIds: z.array(z.string().min(1)).min(1),
    name: z.string().min(1),
    playerCharacter: z.boolean(),
    active: z.boolean(),
    done: z.boolean(),
    alive: z.boolean(),
    currentHp: z.number().int().nonnegative(),
    maxHp: z.number().int().nonnegative(),
    armorClass: z.number().int().nonnegative(),
    initiative: z.number().int().min(-10).max(40),
    count: z.number().int().positive(),
    aliveCount: z.number().int().nonnegative(),
    conditions: z.array(combatConditionSchema),
    concentrating: z.boolean(),
    exhaustionLevel: exhaustionLevelSchema,
    detail: z.string()
  })
  .strict()

export const resultEnemySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    alive: z.boolean(),
    xp: z.number().int().nonnegative(),
    selected: z.boolean()
  })
  .strict()

export const resolutionModeSchema = z.enum(['defeated', 'manual'])

export const resolutionSchema = z
  .object({
    enemies: z.array(resultEnemySchema),
    mode: resolutionModeSchema,
    xpFraction: z.number().min(0).max(1),
    eligibleXp: z.number().int().nonnegative(),
    awardedXp: z.number().int().nonnegative(),
    perPlayerXp: z.number().int().nonnegative(),
    partySize: z.number().int().positive(),
    xpAwarded: z.boolean(),
    lootSummary: z.string()
  })
  .strict()

export const combatSnapshotSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    phase: z.enum(['initiative', 'combat', 'resolution']),
    selectedGroupIds: z.array(z.uuid()),
    initiativeRows: z.array(initiativeRowSchema),
    cards: z.array(combatCardSchema),
    round: z.number().int().positive(),
    undoLabel: z.string().min(1).nullable(),
    allEnemiesDefeated: z.boolean(),
    resolution: resolutionSchema.nullable()
  })
  .strict()

export const liveSessionSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    party: partySnapshotSchema,
    scene: sceneSnapshotSchema,
    travel: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('none'),
          label: z.string(),
          hint: z.string()
        })
        .strict(),
      hexTravelSnapshotSchema
        .pick({
          status: true,
          mapId: true,
          mapName: true,
          currentLabel: true,
          locationName: true,
          progress: true,
          remainingGameSeconds: true,
          gameTimeSeconds: true,
          effectiveSpeedFeet: true,
          assumedSpeedMemberNames: true,
          multiplier: true,
          hint: true
        })
        .extend({ kind: z.literal('hex') })
        .strict()
    ]),
    combat: combatSnapshotSchema.nullable()
  })
  .strict()

export const prepareCombatInputSchema = z
  .object({
    sceneId: z.uuid(),
    expectedSceneRevision: z.number().int().nonnegative(),
    groupIds: z.array(z.uuid()).min(1)
  })
  .strict()

export const confirmInitiativeInputSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    values: z.array(
      z
        .object({
          id: z.string().min(1),
          initiative: z.number().int().min(-10).max(40)
        })
        .strict()
    )
  })
  .strict()

export const combatRevisionInputSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict()

export const adjustInitiativeInputSchema = combatRevisionInputSchema
  .extend({
    id: z.string().min(1),
    initiative: z.number().int().min(-10).max(40)
  })
  .strict()

export const changeHpInputSchema = combatRevisionInputSchema
  .extend({
    cardId: z.string().min(1),
    amount: z.number().int().positive(),
    healing: z.boolean()
  })
  .strict()

export const toggleConditionInputSchema = combatRevisionInputSchema
  .extend({
    cardId: z.string().min(1),
    condition: combatConditionSchema,
    active: z.boolean()
  })
  .strict()

export const setConcentrationInputSchema = combatRevisionInputSchema
  .extend({
    cardId: z.string().min(1),
    concentrating: z.boolean()
  })
  .strict()

export const setExhaustionInputSchema = combatRevisionInputSchema
  .extend({
    cardId: z.string().min(1),
    exhaustionLevel: exhaustionLevelSchema
  })
  .strict()

export const updateResolutionInputSchema = combatRevisionInputSchema
  .extend({
    selectedEnemyIds: z.array(z.string().min(1)),
    mode: resolutionModeSchema,
    xpFraction: z.number().min(0).max(1)
  })
  .strict()

export const joinCombatGroupInputSchema = z
  .object({
    sceneId: z.uuid(),
    groupId: z.uuid(),
    expectedGroupRevision: z.number().int().nonnegative(),
    expectedCombatRevision: z.number().int().nonnegative()
  })
  .strict()

export const moveCombatPhaseInputSchema = combatRevisionInputSchema
  .extend({ target: z.enum(['selection', 'initiative', 'combat']) })
  .strict()

export const sceneGroupPatchSchema = z
  .object({
    sceneId: z.uuid(),
    sceneRevision: z.number().int().nonnegative(),
    upsertedGroups: z.array(sceneGroupSchema),
    removedGroupIds: z.array(z.uuid())
  })
  .strict()

export const combatCommandResultSchema = z
  .object({
    combat: combatSnapshotSchema.nullable(),
    scenePatch: sceneGroupPatchSchema.nullable(),
    party: partySnapshotSchema.nullable()
  })
  .strict()

export const sceneGroupCommandResultSchema = z
  .object({
    scenePatch: sceneGroupPatchSchema,
    combat: combatSnapshotSchema.nullable()
  })
  .strict()

export type PartyMember = Readonly<z.infer<typeof partyCharacterSchema>>
export type PartySnapshot = Readonly<z.infer<typeof partySnapshotSchema>>
export type CombatSnapshot = Readonly<z.infer<typeof combatSnapshotSchema>>
export type { CombatCondition }
export type CombatCommandResult = Readonly<
  z.infer<typeof combatCommandResultSchema>
>
export type SceneGroupCommandResult = Readonly<
  z.infer<typeof sceneGroupCommandResultSchema>
>
export type LiveSessionSnapshot = Readonly<
  z.infer<typeof liveSessionSnapshotSchema>
>
