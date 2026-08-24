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
    revision: z.number().int().nonnegative(),
    activeCampaignId: z.uuid().nullable(),
    campaigns: z.array(campaignSchema),
    trashedCampaigns: z.array(trashedCampaignSchema)
  })
  .strict()

export type CampaignSnapshot = Readonly<{
  revision: number
  activeCampaignId: string | null
  campaigns: readonly Campaign[]
  trashedCampaigns: readonly Readonly<z.infer<typeof trashedCampaignSchema>>[]
}>

export function freezeCampaignSnapshot(
  snapshot: z.infer<typeof campaignSnapshotSchema>
): CampaignSnapshot {
  return Object.freeze({
    revision: snapshot.revision,
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

const campaignCommandBaseInputSchema = z
  .object({
    commandId: z.uuid(),
    expectedRegistryRevision: z.number().int().nonnegative()
  })
  .strict()

export const createCampaignInputSchema = campaignCommandBaseInputSchema
  .extend({
    name: z.string().trim().min(1, 'A name is required').max(100)
  })
  .strict()

export const activateCampaignInputSchema = campaignCommandBaseInputSchema
  .extend({
    id: z.uuid()
  })
  .strict()

export const renameCampaignInputSchema = campaignCommandBaseInputSchema
  .extend({
    id: z.uuid(),
    name: z.string().trim().min(1, 'A name is required').max(100)
  })
  .strict()

export const campaignIdInputSchema = campaignCommandBaseInputSchema
  .extend({
    id: z.uuid()
  })
  .strict()

export const permanentlyDeleteCampaignInputSchema =
  campaignCommandBaseInputSchema
    .extend({
      id: z.uuid(),
      confirmationName: z.string().max(100)
    })
    .strict()

const campaignCommandReceiptBase = {
  commandId: z.uuid(),
  campaignId: z.uuid(),
  snapshot: campaignSnapshotSchema
} as const

export const createCampaignReceiptSchema = z
  .object({ ...campaignCommandReceiptBase, kind: z.literal('created') })
  .strict()
  .superRefine((receipt, context) => {
    if (
      receipt.snapshot.activeCampaignId !== receipt.campaignId ||
      !receipt.snapshot.campaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      )
    )
      invalidReceipt(context)
  })
export const activateCampaignReceiptSchema = z
  .object({ ...campaignCommandReceiptBase, kind: z.literal('activated') })
  .strict()
  .superRefine((receipt, context) => {
    if (
      receipt.snapshot.activeCampaignId !== receipt.campaignId ||
      !receipt.snapshot.campaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      )
    )
      invalidReceipt(context)
  })
export const renameCampaignReceiptSchema = z
  .object({ ...campaignCommandReceiptBase, kind: z.literal('renamed') })
  .strict()
  .superRefine((receipt, context) => {
    if (
      !receipt.snapshot.campaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      )
    )
      invalidReceipt(context)
  })
export const trashCampaignReceiptSchema = z
  .object({ ...campaignCommandReceiptBase, kind: z.literal('trashed') })
  .strict()
  .superRefine((receipt, context) => {
    if (
      receipt.snapshot.activeCampaignId === receipt.campaignId ||
      !receipt.snapshot.trashedCampaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      )
    )
      invalidReceipt(context)
  })
export const restoreCampaignReceiptSchema = z
  .object({ ...campaignCommandReceiptBase, kind: z.literal('restored') })
  .strict()
  .superRefine((receipt, context) => {
    if (
      !receipt.snapshot.campaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      ) ||
      receipt.snapshot.trashedCampaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      )
    )
      invalidReceipt(context)
  })
export const deleteCampaignReceiptSchema = z
  .object({ ...campaignCommandReceiptBase, kind: z.literal('deleted') })
  .strict()
  .superRefine((receipt, context) => {
    if (
      receipt.snapshot.campaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      ) ||
      receipt.snapshot.trashedCampaigns.some(
        (campaign) => campaign.id === receipt.campaignId
      )
    )
      invalidReceipt(context)
  })
export const campaignCommandReceiptSchema = z.discriminatedUnion('kind', [
  createCampaignReceiptSchema,
  activateCampaignReceiptSchema,
  renameCampaignReceiptSchema,
  trashCampaignReceiptSchema,
  restoreCampaignReceiptSchema,
  deleteCampaignReceiptSchema
])
export const campaignCommandReceiptInputSchema = z
  .object({ commandId: z.uuid() })
  .strict()

export type CreateCampaignCommand = z.infer<typeof createCampaignInputSchema>
export type ActivateCampaignCommand = z.infer<
  typeof activateCampaignInputSchema
>
export type RenameCampaignCommand = z.infer<typeof renameCampaignInputSchema>
export type CampaignIdCommand = z.infer<typeof campaignIdInputSchema>
export type DeleteCampaignCommand = z.infer<
  typeof permanentlyDeleteCampaignInputSchema
>
export type CreateCampaignReceipt = z.infer<typeof createCampaignReceiptSchema>
export type ActivateCampaignReceipt = z.infer<
  typeof activateCampaignReceiptSchema
>
export type RenameCampaignReceipt = z.infer<typeof renameCampaignReceiptSchema>
export type TrashCampaignReceipt = z.infer<typeof trashCampaignReceiptSchema>
export type RestoreCampaignReceipt = z.infer<
  typeof restoreCampaignReceiptSchema
>
export type DeleteCampaignReceipt = z.infer<typeof deleteCampaignReceiptSchema>
export type CampaignCommandReceipt = z.infer<
  typeof campaignCommandReceiptSchema
>

function invalidReceipt(context: z.RefinementCtx): void {
  context.addIssue({
    code: 'custom',
    path: ['snapshot'],
    message: 'Campaign command receipt snapshot is inconsistent.'
  })
}

export const coreReadySchema = z
  .object({ kind: z.literal('core.ready') })
  .strict()
