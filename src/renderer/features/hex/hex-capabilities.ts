import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type HexCapabilities = Pick<
  SaltMarcherApi,
  'hex' | 'hexTravel' | 'session' | 'locations' | 'locationSymbols' | 'biomes'
> & {
  runtime: Pick<SaltMarcherApi['runtime'], 'pickLocationSymbolFile'>
}

/** Narrow feature adapter for map, travel, location and session capabilities. */
export function hexCapabilities(api: SaltMarcherApi): HexCapabilities {
  return {
    hex: api.hex,
    hexTravel: api.hexTravel,
    session: api.session,
    locations: api.locations,
    locationSymbols: api.locationSymbols,
    biomes: api.biomes,
    runtime: { pickLocationSymbolFile: api.runtime.pickLocationSymbolFile }
  }
}
