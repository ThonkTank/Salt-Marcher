import { z } from 'zod'

export const sessionChangeNoticeSchema = z
  .object({
    campaignId: z.uuid(),
    sceneId: z.uuid(),
    revision: z.number().int().nonnegative(),
    reason: z.enum([
      'travel-boundary',
      'travel-command',
      'campaign-reconcile',
      'projection-invalidated',
      'map-edit'
    ])
  })
  .strict()
  .readonly()

export type SessionChangeNotice = Readonly<
  z.infer<typeof sessionChangeNoticeSchema>
>
