import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type BiomeCatalogCapabilities = Pick<
  SaltMarcherApi,
  'biomes' | 'encounterTables'
>

export function biomeCatalogCapabilities(
  api: SaltMarcherApi
): BiomeCatalogCapabilities {
  return {
    biomes: api.biomes,
    encounterTables: api.encounterTables
  }
}
