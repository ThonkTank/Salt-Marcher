import { useContext, useMemo, useSyncExternalStore } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
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
  session: Readonly<{ read(): Promise<LiveSessionSnapshot> }>
  campaignRules: Pick<SaltMarcherApi['campaignRules'], 'read'>
  loot: Pick<
    SaltMarcherApi['loot'],
    | 'catalog'
    | 'generateForGroupDraft'
    | 'commitGroupReward'
    | 'groupRewardReceipt'
  >
  biomes: Pick<SaltMarcherApi['biomes'], 'search'>
  combat: Pick<SaltMarcherApi['combat'], 'joinGroup'>
}>

export function useGroupManagerCapabilityPorts(): GroupManagerPorts {
  const api = useCapabilityApi()
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability provider missing')
  const projection = context.campaignWorkspace
  const root = useSyncExternalStore(projection.subscribe, projection.snapshot)
  const campaignId = root.sessionCampaignId
  return useMemo(
    () => ({
      runtime: { e2e: api.runtime.e2e },
      creatures: createCreatureCapabilityPort(api.creatures),
      scene: sessionCapabilities(api).scene,
      session: {
        read: () => {
          const current = projection.snapshot()
          if (
            !campaignId ||
            current.sessionCampaignId !== campaignId ||
            current.campaigns.activeCampaignId !== campaignId
          )
            return Promise.reject(new CapabilityError('stale', false))
          return api.session.read({ campaignId })
        }
      },
      campaignRules: api.campaignRules,
      loot: api.loot,
      biomes: api.biomes,
      combat: encounterCapabilities(api).combat
    }),
    [api, campaignId, projection]
  )
}
