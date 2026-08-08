import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type EncounterTableCapabilities = Pick<SaltMarcherApi, 'encounterTables'>

export function encounterTableCapabilities(
  api: SaltMarcherApi
): EncounterTableCapabilities {
  return api
}
