import { useContext, useMemo, useSyncExternalStore } from 'react'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'

export type LootScenePort = Pick<
  SaltMarcherApi['loot'],
  'scene' | 'inbox' | 'onChanged'
>

export type GroupLootPort = Readonly<{
  e2e: boolean
  readRules: SaltMarcherApi['campaignRules']['read']
  generate: SaltMarcherApi['loot']['generateForGroupDraft']
  commit: SaltMarcherApi['loot']['commitGroupReward']
}>

export type LootCatalogPort = Pick<SaltMarcherApi['loot'], 'catalog'>

export type CharacterLootPort = Pick<
  SaltMarcherApi['loot'],
  'ledger' | 'correctLedger'
> &
  Readonly<{
    correctionStatus(
      input: Parameters<SaltMarcherApi['loot']['correctLedger']>[0]
    ): ReturnType<SaltMarcherApi['loot']['ledgerCorrectionStatus']>
  }>

export type TreasureEditorPort = Pick<
  SaltMarcherApi['loot'],
  'create' | 'update' | 'catalog'
>

export type RewardDistributionPort = Pick<SaltMarcherApi['loot'], 'distribute'>

export function useLootScenePort(): LootScenePort {
  const loot = useCapabilityApi().loot
  return useMemo(
    () => ({
      scene: loot.scene,
      inbox: loot.inbox,
      onChanged: loot.onChanged
    }),
    [loot]
  )
}

export function useGroupLootPort(): GroupLootPort {
  const api = useCapabilityApi()
  return useMemo(
    () => ({
      e2e: api.runtime.e2e,
      readRules: api.campaignRules.read,
      generate: api.loot.generateForGroupDraft,
      commit: api.loot.commitGroupReward
    }),
    [api.campaignRules, api.loot, api.runtime.e2e]
  )
}

export function useLootCatalogPort(): LootCatalogPort {
  const loot = useCapabilityApi().loot
  return useMemo(() => ({ catalog: loot.catalog }), [loot])
}

export function useCharacterLootPort(): CharacterLootPort {
  const loot = useCapabilityApi().loot
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability provider missing')
  const projection = context.campaignWorkspace
  const root = useSyncExternalStore(projection.subscribe, projection.snapshot)
  const campaignId = root.sessionCampaignId
  return useMemo(() => {
    const requireCampaign = () => {
      const current = projection.snapshot()
      if (
        !campaignId ||
        current.sessionCampaignId !== campaignId ||
        current.campaigns.activeCampaignId !== campaignId
      )
        throw new CapabilityError('stale', false)
      return campaignId
    }
    return {
      ledger: async (input) => {
        const value = await loot.ledgerForCampaign({
          ...input,
          campaignId: requireCampaign()
        })
        requireCampaign()
        return value
      },
      correctLedger: async (input) => {
        const value = await loot.correctLedgerForCampaign({
          ...input,
          campaignId: requireCampaign()
        })
        requireCampaign()
        return value
      },
      correctionStatus: async (input) => {
        const value = await loot.ledgerCorrectionStatus({
          ...input,
          campaignId: requireCampaign()
        })
        requireCampaign()
        return value
      }
    } satisfies CharacterLootPort
  }, [loot, projection, campaignId])
}

export function useTreasureEditorPort(): TreasureEditorPort {
  const loot = useCapabilityApi().loot
  return useMemo(
    () => ({ create: loot.create, update: loot.update, catalog: loot.catalog }),
    [loot]
  )
}

export function useRewardDistributionPort(): RewardDistributionPort {
  const loot = useCapabilityApi().loot
  return useMemo(() => ({ distribute: loot.distribute }), [loot])
}
