import { z } from 'zod'
import {
  deleteSceneGroupInputSchema,
  setSceneGroupArchivedInputSchema
} from './scene.js'
import {
  liveSessionSnapshotSchema,
  sceneGroupCommandResultSchema
} from './live-session.js'
export const sceneGroupLifecycleCommandSchema = z
  .object({
    commandId: z.uuid(),
    command: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('archive'),
          input: setSceneGroupArchivedInputSchema
        })
        .strict(),
      z
        .object({
          kind: z.literal('delete'),
          input: deleteSceneGroupInputSchema
        })
        .strict()
    ])
  })
  .strict()
export const campaignSceneGroupLifecycleCommandSchema =
  sceneGroupLifecycleCommandSchema.extend({ campaignId: z.uuid() })
export const sceneGroupLifecycleStatusSchema = z
  .object({
    receipt: sceneGroupCommandResultSchema.nullable(),
    snapshot: liveSessionSnapshotSchema
  })
  .strict()
export type SceneGroupLifecycleCommand = z.infer<
  typeof sceneGroupLifecycleCommandSchema
>
