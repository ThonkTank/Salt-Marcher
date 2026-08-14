import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type { LivePlayService } from '../../core/encounter/live-combat.js'
import type { HexTravelService } from '../../core/hex/hex-travel.js'

type TravelHandlerName =
  | 'hexTravel.read'
  | 'hexTravel.evaluate'
  | 'hexTravel.position'
  | 'hexTravel.start'
  | 'hexTravel.pause'
  | 'hexTravel.resume'
  | 'hexTravel.abort'
  | 'hexTravel.setMultiplier'

export function createTravelHandlers(dependencies: {
  travel: HexTravelService
  play: LivePlayService
}): Pick<CoreHandlers, TravelHandlerName> {
  const { travel, play } = dependencies
  const context = (snapshot: ReturnType<HexTravelService['read']>) => ({
    travel: snapshot,
    session: play.readSession()
  })
  return {
    'hexTravel.read': (input) => context(travel.read(input.sceneId)),
    'hexTravel.evaluate': (input) => travel.evaluate(input),
    'hexTravel.position': (input) => context(travel.position(input)),
    'hexTravel.start': (input) => context(travel.start(input)),
    'hexTravel.pause': (input) => context(travel.pause(input)),
    'hexTravel.resume': (input) => context(travel.resume(input)),
    'hexTravel.abort': (input) => context(travel.abort(input)),
    'hexTravel.setMultiplier': (input) => context(travel.setMultiplier(input))
  }
}
