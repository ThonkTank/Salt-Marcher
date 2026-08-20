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
  play: LivePlayService
  publishChange: (
    snapshot: ReturnType<HexTravelService['read']>,
    reason: 'travel-command'
  ) => void
}): OperationHandlers<typeof hexTravelOperationDefinitions> {
  const { travel, play } = dependencies
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
