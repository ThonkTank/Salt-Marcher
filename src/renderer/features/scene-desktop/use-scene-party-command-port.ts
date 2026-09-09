import { useContext, useMemo } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { ScenePartyCommand } from '../../../shared/contracts/scene-party-command.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'

export type ScenePartyCommandPort = Readonly<{
  execute(
    input: ScenePartyCommand
  ): ReturnType<SaltMarcherApi['scene']['executePartyCommand']>
  status(
    input: ScenePartyCommand
  ): ReturnType<SaltMarcherApi['scene']['partyCommandStatus']>
  current(): LiveSessionSnapshot
  refresh(): Promise<LiveSessionSnapshot>
}>

/** Retain this port with the original draft and every unresolved command. */
export function useScenePartyCommandPort(
  campaignId: string
): ScenePartyCommandPort {
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
        const receipt = await api.scene.executePartyCommand({
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
        const result = await api.scene.partyCommandStatus({
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
    } satisfies ScenePartyCommandPort
  }, [api, projection, campaignId])
}
