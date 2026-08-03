import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type EncounterCapabilities = Pick<SaltMarcherApi, 'combat' | 'encounter'>

/** Narrow feature adapter for encounter evaluation and combat mutations. */
export function encounterCapabilities(): EncounterCapabilities {
  return window.saltMarcher
}
