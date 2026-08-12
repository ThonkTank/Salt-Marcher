import { z } from 'zod'
import { capabilityErrorCodes } from '../errors/capability-error-code.js'
import { capabilityIssueCodes } from '../errors/capability-issue.js'

export type { CapabilityErrorCode } from '../errors/capability-error-code.js'

export const campaignSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(100),
    createdAt: z.iso.datetime()
  })
  .strict()

export type Campaign = Readonly<z.infer<typeof campaignSchema>>

export const trashedCampaignSchema = campaignSchema.extend({
  trashedAt: z.iso.datetime()
})

export const campaignSnapshotSchema = z
  .object({
    activeCampaignId: z.uuid().nullable(),
    campaigns: z.array(campaignSchema),
    trashedCampaigns: z.array(trashedCampaignSchema)
  })
  .strict()

export type CampaignSnapshot = Readonly<{
  activeCampaignId: string | null
  campaigns: readonly Campaign[]
  trashedCampaigns: readonly Readonly<z.infer<typeof trashedCampaignSchema>>[]
}>

export function freezeCampaignSnapshot(
  snapshot: z.infer<typeof campaignSnapshotSchema>
): CampaignSnapshot {
  return Object.freeze({
    activeCampaignId: snapshot.activeCampaignId,
    campaigns: Object.freeze(
      snapshot.campaigns.map((campaign) => Object.freeze({ ...campaign }))
    ),
    trashedCampaigns: Object.freeze(
      snapshot.trashedCampaigns.map((campaign) =>
        Object.freeze({ ...campaign })
      )
    )
  })
}

export const capabilityErrorCodeSchema = z.enum(capabilityErrorCodes)
export const capabilityIssueSchema = z
  .object({
    code: z.enum(capabilityIssueCodes),
    path: z
      .array(z.union([z.string().max(100), z.number().int().nonnegative()]))
      .max(12),
    parameters: z
      .record(
        z.string().max(50),
        z.union([z.string().max(200), z.number(), z.boolean(), z.null()])
      )
      .default({})
  })
  .strict()
export const capabilityFailureSchema = z
  .object({
    code: capabilityErrorCodeSchema,
    retryable: z.boolean(),
    issues: z.array(capabilityIssueSchema).max(100).optional(),
    data: z.never().optional()
  })
  .strict()
  .superRefine((failure, context) => {
    if (failure.issues && failure.code !== 'validation_failed')
      context.addIssue({
        code: 'custom',
        path: ['issues'],
        message: 'Structured issues are limited to validation failures.'
      })
  })

export const createCampaignInputSchema = z
  .object({ name: z.string().trim().min(1, 'A name is required').max(100) })
  .strict()

export const activateCampaignInputSchema = z.object({ id: z.uuid() }).strict()

export const renameCampaignInputSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1, 'A name is required').max(100)
  })
  .strict()

export const campaignIdInputSchema = z.object({ id: z.uuid() }).strict()

export const permanentlyDeleteCampaignInputSchema = z
  .object({
    id: z.uuid(),
    confirmationName: z.string().max(100)
  })
  .strict()

export const coreReadySchema = z
  .object({ kind: z.literal('core.ready') })
  .strict()
