import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type CatalogCapabilities = Pick<
  SaltMarcherApi,
  'factions' | 'locations' | 'npcs' | 'session' | 'encounterTables'
>

/** Narrow feature adapter; Catalog owns all access to its preload groups. */
export function catalogCapabilities(api: SaltMarcherApi): CatalogCapabilities {
  return api
}
