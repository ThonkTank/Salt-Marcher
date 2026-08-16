import { useMemo } from 'react'
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
>

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
  return useMemo(
    () => ({ ledger: loot.ledger, correctLedger: loot.correctLedger }),
    [loot]
  )
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
