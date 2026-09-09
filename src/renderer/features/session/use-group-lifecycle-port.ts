import { useContext, useMemo } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { SceneGroupLifecycleCommand } from '../../../shared/contracts/scene-group-lifecycle.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'

export type GroupLifecyclePort = Readonly<{
  execute(
    input: SceneGroupLifecycleCommand
  ): ReturnType<SaltMarcherApi['scene']['executeGroupLifecycle']>
  status(
    input: SceneGroupLifecycleCommand
  ): ReturnType<SaltMarcherApi['scene']['groupLifecycleStatus']>
  current(): LiveSessionSnapshot
  refresh(): Promise<LiveSessionSnapshot>
}>

/** Retain this port with the original draft and every unresolved command. */
export function useGroupLifecyclePort(campaignId: string): GroupLifecyclePort {
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability provider missing')
  const { api, campaignWorkspace: projection } = context
  return useMemo(() => {
    const requireCampaign = () => {
      const current = projection.snapshot()
      if (
        current.sessionCampaignId !== campaignId ||
        current.campaigns.activeCampaignId !== campaignId
      )
        throw new CapabilityError('stale', false)
    }
    return {
      current: () => {
        requireCampaign()
        const session = projection.snapshot().session
        if (!session) throw new CapabilityError('stale', false)
        return session
      },
      execute: async (input) => {
        requireCampaign()
        const receipt = await api.scene.executeGroupLifecycle({
          ...input,
          campaignId
        })
        try {
          requireCampaign()
        } catch {
          throw new CapabilityError('outcome_unknown', true)
        }
        return receipt
      },
      status: async (input) => {
        requireCampaign()
        const result = await api.scene.groupLifecycleStatus({
          ...input,
          campaignId
        })
        requireCampaign()
        return result
      },
      refresh: async () => {
        requireCampaign()
        const result = await projection.refreshActiveSession()
        requireCampaign()
        if (result.status === 'failure') throw result.cause
        if (
          result.status !== 'ready' ||
          result.value.sessionCampaignId !== campaignId ||
          result.value.campaigns.activeCampaignId !== campaignId ||
          !result.value.session
        )
          throw new CapabilityError('stale', false)
        return result.value.session
      }
    } satisfies GroupLifecyclePort
  }, [api, projection, campaignId])
}
