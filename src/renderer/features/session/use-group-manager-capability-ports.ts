import { useMemo } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import {
  createCreatureCapabilityPort,
  type CreatureCapabilityPort
} from '../creatures/creatures-capabilities.js'
import { encounterCapabilities } from '../encounter/encounter-capabilities.js'
import {
  sessionCapabilities,
  type SessionCapabilities
} from './session-capabilities.js'

export type GroupManagerPorts = Readonly<{
  runtime: Readonly<{ e2e: boolean }>
  creatures: CreatureCapabilityPort
  scene: SessionCapabilities['scene']
  campaignRules: Pick<SaltMarcherApi['campaignRules'], 'read'>
  loot: Pick<
    SaltMarcherApi['loot'],
    'catalog' | 'generateForGroupDraft' | 'commitGroupReward'
  >
  biomes: Pick<SaltMarcherApi['biomes'], 'search'>
  combat: Pick<SaltMarcherApi['combat'], 'joinGroup'>
}>

export function useGroupManagerCapabilityPorts(): GroupManagerPorts {
  const api = useCapabilityApi()
  return useMemo(
    () => ({
      runtime: { e2e: api.runtime.e2e },
      creatures: createCreatureCapabilityPort(api.creatures),
      scene: sessionCapabilities(api).scene,
      campaignRules: api.campaignRules,
      loot: api.loot,
      biomes: api.biomes,
      combat: encounterCapabilities(api).combat
    }),
    [api]
  )
}
