import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { rendererCapabilityApi } from '../../capabilities/renderer-capability-api.js'

export type CatalogCapabilities = Pick<
  SaltMarcherApi,
  'creatures' | 'encounterTables' | 'factions' | 'locations' | 'session'
>

/** Narrow feature adapter; Catalog owns all access to its preload groups. */
export function catalogCapabilities(): CatalogCapabilities {
  return rendererCapabilityApi()
}
