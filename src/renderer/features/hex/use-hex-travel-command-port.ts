import { useContext, useMemo } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  HexTravelCommand,
  HexTravelCommandState
} from '../../../shared/contracts/hex-travel-command.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'

export type HexTravelCommandPort = Readonly<{
  execute(
    input: HexTravelCommand
  ): ReturnType<SaltMarcherApi['hexTravel']['executeCommand']>
  status(
    input: HexTravelCommand
  ): ReturnType<SaltMarcherApi['hexTravel']['commandStatus']>
  current(): LiveSessionSnapshot
  refresh(): Promise<HexTravelCommandState>
}>

/** Keep the original campaign and scene with every unresolved travel intent. */
export function useHexTravelCommandPort(
  campaignId: string,
  sceneId: string
): HexTravelCommandPort {
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
    const requireOriginal = (input: HexTravelCommand) => {
      requireCampaign()
      if (input.command.input.sceneId !== sceneId)
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
        requireOriginal(input)
        const receipt = await api.hexTravel.executeCommand({
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
        requireOriginal(input)
        const result = await api.hexTravel.commandStatus({
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
        const state = await api.hexTravel.readState({ campaignId, sceneId })
        requireCampaign()
        return state
      }
    } satisfies HexTravelCommandPort
  }, [api, projection, campaignId, sceneId])
}
