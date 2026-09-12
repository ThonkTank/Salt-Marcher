import { partyCommandGate } from './party-command-gate.js'
import { useContext, useMemo } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { PartyCharacterCommand } from '../../../shared/contracts/party.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'

export type CharacterCommandPort = Readonly<{
  execute(
    input: PartyCharacterCommand
  ): ReturnType<SaltMarcherApi['party']['executeCharacterCommand']>
  status(
    input: PartyCharacterCommand
  ): ReturnType<SaltMarcherApi['party']['characterCommandStatus']>
  refresh(): Promise<LiveSessionSnapshot>
}>

/** Retain this port with the original draft and every unresolved command. */
export function useCharacterCommandPort(
  campaignId: string
): CharacterCommandPort {
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
      execute: async (input) => {
        requireCampaign()
        const receipt = await partyCommandGate(api, campaignId).run(
          () => api.party.executeCharacterCommand({ ...input, campaignId }),
          () => api.party.characterCommandStatus({ ...input, campaignId })
        )
        try {
          requireCampaign()
        } catch {
          throw new CapabilityError('outcome_unknown', true)
        }
        return receipt
      },
      status: async (input) => {
        requireCampaign()
        const result = await api.party.characterCommandStatus({
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
    } satisfies CharacterCommandPort
  }, [api, projection, campaignId])
}
