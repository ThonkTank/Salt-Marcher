import { z } from 'zod'
import { liveSessionSnapshotSchema } from '../live-session.js'
import { read, utilityOperationFragment } from './registry.js'

export const activeCampaignSessionInputSchema = z
  .object({ campaignId: z.uuid() })
  .strict()

export const sessionOperationDefinitions = utilityOperationFragment({
  'session.read': read(
    'session:read',
    activeCampaignSessionInputSchema,
    liveSessionSnapshotSchema
  )
})
