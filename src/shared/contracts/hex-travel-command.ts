import { z } from 'zod'
import {
  mutateHexTravelInputSchema,
  positionHexPartyInputSchema,
  setHexTravelMultiplierInputSchema,
  startHexTravelInputSchema
} from './hex.js'
import { hexTravelContextResultSchema } from './live-session.js'

/** A saved plan is independent of an active journey and its clock. */
export const hexRoutePlanSchema = startHexTravelInputSchema.pick({
  mapId: true,
  waypoints: true,
  multiplier: true
})
export const hexRoutePlanSnapshotSchema = z
  .object({
    sceneId: z.uuid(),
    revision: z.number().int().nonnegative(),
    plan: hexRoutePlanSchema.nullable()
  })
  .strict()

export const saveHexRoutePlanInputSchema = z
  .object({
    sceneId: z.uuid(),
    expectedPlanRevision: z.number().int().nonnegative(),
    expectedSceneRevision: z.number().int().nonnegative(),
    plan: hexRoutePlanSchema.nullable()
  })
  .strict()

export const hexTravelCommandSchema = z
  .object({
    commandId: z.uuid(),
    command: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('save-plan'),
          input: saveHexRoutePlanInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('position'),
          input: positionHexPartyInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('start'),
          input: startHexTravelInputSchema.extend({
            expectedSceneRevision: z.number().int().nonnegative()
          })
        })
        .strict(),
      z
        .object({ kind: z.literal('pause'), input: mutateHexTravelInputSchema })
        .strict(),
      z
        .object({
          kind: z.literal('resume'),
          input: mutateHexTravelInputSchema
        })
        .strict(),
      z
        .object({ kind: z.literal('abort'), input: mutateHexTravelInputSchema })
        .strict(),
      z
        .object({
          kind: z.literal('set-multiplier'),
          input: setHexTravelMultiplierInputSchema
        })
        .strict()
    ])
  })
  .strict()
export const campaignHexTravelCommandSchema = hexTravelCommandSchema.extend({
  campaignId: z.uuid()
})
export const hexTravelCommandReceiptSchema = z
  .object({
    context: hexTravelContextResultSchema,
    routePlan: hexRoutePlanSnapshotSchema
  })
  .strict()
export const hexTravelCommandStatusSchema = z
  .object({
    receipt: hexTravelCommandReceiptSchema.nullable(),
    context: hexTravelContextResultSchema,
    routePlan: hexRoutePlanSnapshotSchema
  })
  .strict()

export type HexRoutePlan = z.infer<typeof hexRoutePlanSchema>
export type HexRoutePlanSnapshot = z.infer<typeof hexRoutePlanSnapshotSchema>
export type HexTravelCommand = z.infer<typeof hexTravelCommandSchema>
export type HexTravelCommandReceipt = z.infer<
  typeof hexTravelCommandReceiptSchema
>
