import { z } from 'zod'
import { setSceneLocationInputSchema, focusSceneInputSchema } from './scene.js'
import {
  scenePartyCommandSchema,
  scenePartyCommandReceiptSchema,
  scenePartyCommandStatusSchema
} from './scene-party-command.js'

/** Scene-owned commands share the existing immutable snapshot receipt journal. */
export const sceneCommandSchema = z
  .object({
    commandId: z.uuid(),
    command: z.discriminatedUnion('kind', [
      ...scenePartyCommandSchema.shape.command.options,
      z
        .object({
          kind: z.literal('set-location'),
          input: setSceneLocationInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('focus'),
          input: focusSceneInputSchema
            .extend({ sourceSceneId: z.uuid() })
            .strict()
        })
        .strict()
    ])
  })
  .strict()
export const campaignSceneCommandSchema = sceneCommandSchema.extend({
  campaignId: z.uuid()
})
export const sceneCommandReceiptSchema = scenePartyCommandReceiptSchema
export const sceneCommandStatusSchema = scenePartyCommandStatusSchema
export type SceneCommand = z.infer<typeof sceneCommandSchema>
export type SceneCommandReceipt = z.infer<typeof sceneCommandReceiptSchema>
