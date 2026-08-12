import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type CampaignRewardRulesPort = Pick<
  SaltMarcherApi['campaignRules'],
  'read' | 'update' | 'commandReceipt'
>

export function createCampaignRewardRulesPort(
  api: SaltMarcherApi
): CampaignRewardRulesPort {
  return api.campaignRules
}
