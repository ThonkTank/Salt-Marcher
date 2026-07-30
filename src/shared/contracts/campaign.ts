import { z } from 'zod'

export const campaignSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  createdAt: z.iso.datetime()
})

export type Campaign = z.infer<typeof campaignSchema>

export const campaignSnapshotSchema = z.object({
  activeCampaignId: z.uuid().nullable(),
  campaigns: z.array(campaignSchema)
})

export type CampaignSnapshot = z.infer<typeof campaignSnapshotSchema>

export const createCampaignInputSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(100)
})

export const activateCampaignInputSchema = z.object({ id: z.uuid() })

export const coreRequestSchema = z.discriminatedUnion('kind', [
  z.object({ requestId: z.uuid(), kind: z.literal('campaign.list') }),
  z.object({ requestId: z.uuid(), kind: z.literal('core.shutdown') }),
  z.object({
    requestId: z.uuid(),
    kind: z.literal('campaign.create'),
    input: createCampaignInputSchema
  }),
  z.object({
    requestId: z.uuid(),
    kind: z.literal('campaign.activate'),
    input: activateCampaignInputSchema
  })
])

export const coreResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    requestId: z.uuid(),
    ok: z.literal(true),
    snapshot: campaignSnapshotSchema
  }),
  z.object({ requestId: z.uuid(), ok: z.literal(false), error: z.string() })
])

export const coreReadySchema = z.object({ kind: z.literal('core.ready') })

export type CoreRequest = z.infer<typeof coreRequestSchema>
export type CoreResponse = z.infer<typeof coreResponseSchema>
