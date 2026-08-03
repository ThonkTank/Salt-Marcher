import { z } from 'zod'

export const campaignSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(100),
    createdAt: z.iso.datetime()
  })
  .strict()

export type Campaign = Readonly<z.infer<typeof campaignSchema>>

export const campaignSnapshotSchema = z
  .object({
    activeCampaignId: z.uuid().nullable(),
    campaigns: z.array(campaignSchema)
  })
  .strict()

export type CampaignSnapshot = Readonly<{
  activeCampaignId: string | null
  campaigns: readonly Campaign[]
}>

export function freezeCampaignSnapshot(
  snapshot: z.infer<typeof campaignSnapshotSchema>
): CampaignSnapshot {
  return Object.freeze({
    activeCampaignId: snapshot.activeCampaignId,
    campaigns: Object.freeze(
      snapshot.campaigns.map((campaign) => Object.freeze({ ...campaign }))
    )
  })
}

export const capabilityErrorCodeSchema = z.enum([
  'validation_failed',
  'stale',
  'not_found',
  'read_only',
  'timeout',
  'outcome_unknown',
  'core_unavailable',
  'protocol_violation',
  'internal'
])
export type CapabilityErrorCode = z.infer<typeof capabilityErrorCodeSchema>
export const capabilityFailureSchema = z
  .object({
    code: capabilityErrorCodeSchema,
    retryable: z.boolean()
  })
  .strict()

export const campaignCapabilityResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), snapshot: campaignSnapshotSchema }).strict(),
  z.object({ ok: z.literal(false), error: capabilityFailureSchema }).strict()
])

export const createCampaignInputSchema = z
  .object({ name: z.string().trim().min(1, 'A name is required').max(100) })
  .strict()

export const activateCampaignInputSchema = z.object({ id: z.uuid() }).strict()

export const coreRequestSchema = z.discriminatedUnion('kind', [
  z.object({ requestId: z.uuid(), kind: z.literal('campaign.list') }).strict(),
  z.object({ requestId: z.uuid(), kind: z.literal('core.shutdown') }).strict(),
  z
    .object({
      requestId: z.uuid(),
      kind: z.literal('campaign.create'),
      input: createCampaignInputSchema
    })
    .strict(),
  z
    .object({
      requestId: z.uuid(),
      kind: z.literal('campaign.activate'),
      input: activateCampaignInputSchema
    })
    .strict()
])

export const coreResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      requestId: z.uuid(),
      ok: z.literal(true),
      snapshot: campaignSnapshotSchema
    })
    .strict(),
  z
    .object({
      requestId: z.uuid(),
      ok: z.literal(false),
      error: capabilityFailureSchema
    })
    .strict()
])

export const coreReadySchema = z
  .object({ kind: z.literal('core.ready') })
  .strict()

export type CoreRequest = z.infer<typeof coreRequestSchema>
export type CoreResponse = z.infer<typeof coreResponseSchema>
