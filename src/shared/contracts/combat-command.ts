import { z } from 'zod'
import {
  adjustInitiativeInputSchema,
  awardCombatXpInputSchema,
  changeHpInputSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  joinCombatGroupInputSchema,
  moveCombatPhaseInputSchema,
  prepareCombatInputSchema,
  setConcentrationInputSchema,
  setExhaustionInputSchema,
  toggleConditionInputSchema,
  updateResolutionInputSchema,
  combatCommandResultSchema,
  liveSessionSnapshotSchema
} from './live-session.js'
export const combatCommandSchema = z
  .object({
    commandId: z.uuid(),
    sceneId: z.uuid(),
    command: z.discriminatedUnion('kind', [
      z
        .object({ kind: z.literal('prepare'), input: prepareCombatInputSchema })
        .strict(),
      z
        .object({
          kind: z.literal('joinGroup'),
          input: joinCombatGroupInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('rollInitiative'),
          input: combatRevisionInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('confirmInitiative'),
          input: confirmInitiativeInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('advanceTurn'),
          input: combatRevisionInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('retreatTurn'),
          input: combatRevisionInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('adjustInitiative'),
          input: adjustInitiativeInputSchema
        })
        .strict(),
      z
        .object({ kind: z.literal('changeHp'), input: changeHpInputSchema })
        .strict(),
      z
        .object({
          kind: z.literal('toggleCondition'),
          input: toggleConditionInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('setConcentration'),
          input: setConcentrationInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('setExhaustion'),
          input: setExhaustionInputSchema
        })
        .strict(),
      z
        .object({ kind: z.literal('undo'), input: combatRevisionInputSchema })
        .strict(),
      z
        .object({ kind: z.literal('end'), input: combatRevisionInputSchema })
        .strict(),
      z
        .object({
          kind: z.literal('moveToPhase'),
          input: moveCombatPhaseInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('updateResolution'),
          input: updateResolutionInputSchema
        })
        .strict(),
      z
        .object({ kind: z.literal('awardXp'), input: awardCombatXpInputSchema })
        .strict(),
      z
        .object({
          kind: z.literal('complete'),
          input: combatRevisionInputSchema
        })
        .strict()
    ])
  })
  .strict()
export const campaignCombatCommandSchema = combatCommandSchema.extend({
  campaignId: z.uuid()
})
export const combatCommandStatusSchema = z
  .object({
    receipt: combatCommandResultSchema.nullable(),
    snapshot: liveSessionSnapshotSchema
  })
  .strict()
export type CombatCommand = z.infer<typeof combatCommandSchema>
