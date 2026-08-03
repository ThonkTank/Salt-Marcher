import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type PartyCapabilities = Pick<SaltMarcherApi, 'party'>

/** Narrow feature adapter for Party reads, calculations and mutations. */
export function partyCapabilities(): PartyCapabilities {
  return window.saltMarcher
}
