import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type HexCapabilities = Pick<
  SaltMarcherApi,
  'hex' | 'hexTravel' | 'session' | 'locations'
>

/** Narrow feature adapter for map, travel, location and session capabilities. */
export function hexCapabilities(api: SaltMarcherApi): HexCapabilities {
  return api
}
