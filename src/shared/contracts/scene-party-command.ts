import { z } from 'zod'
import {
  setSceneRosterInputSchema,
  moveSceneRosterInputSchema
} from './scene.js'
import { restScenePartyInputSchema } from './party.js'
import { liveSessionSnapshotSchema } from './live-session.js'

export const scenePartyCommandSchema = z
  .object({
    commandId: z.uuid(),
    command: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('set-roster'),
          input: setSceneRosterInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('move-roster'),
          input: moveSceneRosterInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('rest-selected'),
          input: restScenePartyInputSchema
        })
        .strict()
    ])
  })
  .strict()
export const campaignScenePartyCommandSchema = scenePartyCommandSchema.extend({
  campaignId: z.uuid()
})
export const scenePartyCommandReceiptSchema = z
  .object({ snapshot: liveSessionSnapshotSchema })
  .strict()
export const scenePartyCommandStatusSchema = z
  .object({
    receipt: scenePartyCommandReceiptSchema.nullable(),
    snapshot: liveSessionSnapshotSchema
  })
  .strict()
export type ScenePartyCommand = z.infer<typeof scenePartyCommandSchema>
export type ScenePartyCommandReceipt = z.infer<
  typeof scenePartyCommandReceiptSchema
>
