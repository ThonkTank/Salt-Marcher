import {
  campaignRulesCommandReceiptInputSchema,
  campaignRulesSchema,
  updateCampaignRulesInputSchema
} from '../campaign-rules.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

export const campaignRulesOperationDefinitions = utilityOperationFragment({
  'campaignRules.read': read('campaign-rules:read', none, campaignRulesSchema),
  'campaignRules.update': write(
    'campaign-rules:update',
    updateCampaignRulesInputSchema,
    campaignRulesSchema
  ),
  'campaignRules.commandReceipt': read(
    'campaign-rules:command-receipt',
    campaignRulesCommandReceiptInputSchema,
    campaignRulesSchema.nullable()
  )
})
