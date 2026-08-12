import { z } from 'zod'

export const rewardXpBasisSchema = z.enum(['base', 'adjusted'])

export const campaignRulesSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    rewardXpBasis: rewardXpBasisSchema,
    updatedAt: z.iso.datetime()
  })
  .strict()
  .readonly()

export const updateCampaignRulesInputSchema = z
  .object({
    commandId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    rewardXpBasis: rewardXpBasisSchema
  })
  .strict()

export const campaignRulesCommandReceiptInputSchema = z
  .object({ commandId: z.uuid() })
  .strict()

export type RewardXpBasis = z.infer<typeof rewardXpBasisSchema>
export type CampaignRules = Readonly<z.infer<typeof campaignRulesSchema>>
export type UpdateCampaignRulesInput = Readonly<
  z.infer<typeof updateCampaignRulesInputSchema>
>
