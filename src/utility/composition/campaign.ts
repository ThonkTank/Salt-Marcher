import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type { CampaignRulesService } from '../../core/application/campaign-rules-service.js'
import type { GeneratorPresetStore } from '../../core/persistence/sqlite/generator-preset-store.js'
import type { openDevelopmentCampaignStore } from '../../core/persistence/sqlite/campaign-store.js'
import { emptyPassiveProjection } from '../../shared/contracts/passive-display.js'

type CampaignHandlerName =
  | 'campaign.list'
  | 'campaign.create'
  | 'campaign.activate'
  | 'campaign.rename'
  | 'campaign.trash'
  | 'campaign.restore'
  | 'campaign.deleteForever'
  | 'settings.read'
  | 'settings.update'
  | 'campaignRules.read'
  | 'campaignRules.update'
  | 'campaignRules.commandReceipt'
  | 'generatorPresets.readEditor'
  | 'generatorPresets.create'
  | 'generatorPresets.update'
  | 'generatorPresets.delete'
  | 'generatorPresets.assign'
  | 'generatorPresets.commandReceipt'
  | 'projection.read'

export function createCampaignHandlers(dependencies: {
  campaigns: ReturnType<typeof openDevelopmentCampaignStore>
  campaignRules: CampaignRulesService
  generatorPresets: GeneratorPresetStore
  mutateReferences: <T>(work: () => T) => T
  recoverPendingPreparations: () => void
}): Pick<CoreHandlers, CampaignHandlerName> {
  const {
    campaigns,
    campaignRules,
    generatorPresets,
    mutateReferences,
    recoverPendingPreparations
  } = dependencies
  return {
    'campaign.list': () => campaigns.list(),
    'campaign.create': (input) => {
      const result = mutateReferences(() => campaigns.create(input.name))
      recoverPendingPreparations()
      return result
    },
    'campaign.activate': (input) => {
      const result = mutateReferences(() => campaigns.activate(input.id))
      recoverPendingPreparations()
      return result
    },
    'campaign.rename': (input) => campaigns.rename(input.id, input.name),
    'campaign.trash': (input) => campaigns.trash(input.id),
    'campaign.restore': (input) => campaigns.restore(input.id),
    'campaign.deleteForever': (input) =>
      campaigns.deleteForever(input.id, input.confirmationName),
    'settings.read': () => campaigns.readSettings(),
    'settings.update': (input) =>
      campaigns.updateSettings(input.patch, input.expectedRevision),
    'campaignRules.read': () => campaignRules.read(),
    'campaignRules.update': (input) => campaignRules.update(input),
    'campaignRules.commandReceipt': (input) =>
      campaignRules.commandReceipt(input.commandId),
    'generatorPresets.readEditor': (input) =>
      generatorPresets.readEditor(input.campaignId),
    'generatorPresets.create': (input) => generatorPresets.create(input),
    'generatorPresets.update': (input) => generatorPresets.update(input),
    'generatorPresets.delete': (input) => generatorPresets.delete(input),
    'generatorPresets.assign': (input) => generatorPresets.assign(input),
    'generatorPresets.commandReceipt': (input) =>
      generatorPresets.commandReceipt(input.commandId),
    'projection.read': () => emptyPassiveProjection
  }
}
