import type { BiomePage } from '../../../shared/contracts/biome.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

/** Minimal application capability needed by biome option consumers. */
export type BiomeOptionSearchPort = Readonly<{
  search(query?: string, offset?: number, limit?: number): Promise<BiomePage>
}>

export function createBiomeOptionSearchPort(
  port: SaltMarcherApi['biomes']
): BiomeOptionSearchPort {
  return {
    search: (query = '', offset = 0, limit = 50) =>
      port.search({ query, offset, limit })
  }
}
