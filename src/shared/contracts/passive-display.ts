import { z } from 'zod'
import type { CoreProcessStatus } from './runtime.js'

export const passiveProjectionSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    campaignId: z.uuid().nullable(),
    sceneId: z.uuid().nullable(),
    title: z.string(),
    facts: z.array(z.string())
  })
  .strict()
  .readonly()

export type PassiveProjection = Readonly<
  z.infer<typeof passiveProjectionSchema>
>

export const emptyPassiveProjection: PassiveProjection = Object.freeze(
  passiveProjectionSchema.parse({
    revision: 0,
    campaignId: null,
    sceneId: null,
    title: '',
    facts: []
  })
)

export interface PassiveDisplayApi {
  readProjection(): Promise<PassiveProjection>
  onProjectionChanged(
    listener: (projection: PassiveProjection) => void
  ): () => void
  coreStatus(): Promise<CoreProcessStatus>
  onCoreStatus(listener: (status: CoreProcessStatus) => void): () => void
}
