import { partyCommandGate } from '../party/party-command-gate.js'
import { useContext, useMemo } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  PartyHistoryCommand,
  PartyQuickFieldsCommand
} from '../../../shared/contracts/party-actions.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
export type PartyActionCommand = PartyHistoryCommand | PartyQuickFieldsCommand
export type PartyActionPort = Readonly<{
  execute(
    input: PartyActionCommand
  ): ReturnType<SaltMarcherApi['party']['undoRedo']>
  status(
    input: PartyActionCommand
  ): ReturnType<SaltMarcherApi['party']['actionStatus']>
  refresh(): Promise<Awaited<ReturnType<SaltMarcherApi['session']['read']>>>
}>
export function usePartyActionPort(campaignId: string): PartyActionPort {
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability provider missing')
  return useMemo(() => {
    const requireCampaign = () => {
      if (
        context.campaignWorkspace.snapshot().campaigns.activeCampaignId !==
        campaignId
      )
        throw new CapabilityError('stale', false)
    }
    return {
      execute: async (input) => {
        requireCampaign()
        const result = await partyCommandGate(context.api, campaignId).run(
          () =>
            'direction' in input
              ? context.api.party.undoRedo(input)
              : context.api.party.quickFields(input),
          () => context.api.party.actionStatus(input)
        )
        requireCampaign()
        context.installationSettings.publish(result.settings)
        return result
      },
      status: async (input) => {
        requireCampaign()
        const result = await context.api.party.actionStatus(input)
        requireCampaign()
        context.installationSettings.publish(result.result.settings)
        return result
      },
      refresh: async () => {
        requireCampaign()
        const result = await context.campaignWorkspace.refreshActiveSession()
        requireCampaign()
        if (result.status === 'failure') throw result.cause
        if (
          result.status !== 'ready' ||
          !result.value.session ||
          result.value.sessionCampaignId !== campaignId
        )
          throw new CapabilityError('stale', false)
        return result.value.session
      }
    }
  }, [context, campaignId])
}
