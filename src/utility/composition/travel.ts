import type { HexTravelCommandService } from '../../core/hex/hex-travel-command-service.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { hexTravelOperationDefinitions } from '../../shared/contracts/operations/hex-travel.js'
import {
  defineOperationHandlers,
  type OperationHandlers,
  validatedOperationResult
} from '../../shared/contracts/operations/registry.js'
import type { LivePlayService } from '../../core/encounter/live-combat.js'
import type { HexTravelService } from '../../core/hex/hex-travel.js'

export function createTravelHandlers(dependencies: {
  travel: HexTravelService
  commands: HexTravelCommandService
  activeCampaignId: () => string
  play: LivePlayService
  publishChange: (
    snapshot: ReturnType<HexTravelService['read']>,
    reason: 'travel-command'
  ) => void
}): OperationHandlers<typeof hexTravelOperationDefinitions> {
  const { travel, play } = dependencies
  const requireCampaign = (campaignId: string) => {
    if (campaignId !== dependencies.activeCampaignId())
      throw new CapabilityError('stale', false)
  }
  const context = (snapshot: ReturnType<HexTravelService['read']>) => ({
    travel: snapshot,
    session: play.readSession()
  })
  const mutate = (
    definition: Readonly<{
      output: (typeof hexTravelOperationDefinitions)['hexTravel.start']['output']
    }>,
    snapshot: ReturnType<HexTravelService['read']>
  ) =>
    validatedOperationResult(definition, context(snapshot), (result) =>
      dependencies.publishChange(result.travel, 'travel-command')
    )
  return defineOperationHandlers(
    'travel_handlers',
    hexTravelOperationDefinitions,
    {
      'hexTravel.executeCommand': ({ campaignId, ...input }) => {
        requireCampaign(campaignId)
        const receipt = dependencies.commands.execute(input)
        // Replay returns the original receipt, but invalidations describe current data.
        dependencies.publishChange(
          travel.read(input.command.input.sceneId),
          'travel-command'
        )
        return receipt
      },
      'hexTravel.commandStatus': ({ campaignId, ...input }) => {
        requireCampaign(campaignId)
        return dependencies.commands.status(input)
      },
      'hexTravel.readState': ({ campaignId, sceneId }) => {
        requireCampaign(campaignId)
        return dependencies.commands.readState(sceneId)
      },
      'hexTravel.readPlan': ({ campaignId, sceneId }) => {
        requireCampaign(campaignId)
        return dependencies.commands.readPlan(sceneId)
      },
      'hexTravel.read': (input) => context(travel.read(input.sceneId)),
      'hexTravel.evaluate': (input) => travel.evaluate(input),
      'hexTravel.position': (input) =>
        mutate(
          hexTravelOperationDefinitions['hexTravel.position'],
          travel.position(input)
        ),
      'hexTravel.start': (input) =>
        mutate(
          hexTravelOperationDefinitions['hexTravel.start'],
          travel.start(input)
        ),
      'hexTravel.pause': (input) =>
        mutate(
          hexTravelOperationDefinitions['hexTravel.pause'],
          travel.pause(input)
        ),
      'hexTravel.resume': (input) =>
        mutate(
          hexTravelOperationDefinitions['hexTravel.resume'],
          travel.resume(input)
        ),
      'hexTravel.abort': (input) =>
        mutate(
          hexTravelOperationDefinitions['hexTravel.abort'],
          travel.abort(input)
        ),
      'hexTravel.setMultiplier': (input) =>
        mutate(
          hexTravelOperationDefinitions['hexTravel.setMultiplier'],
          travel.setMultiplier(input)
        )
    }
  )
}
