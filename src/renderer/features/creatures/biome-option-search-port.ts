import type { BiomePage } from '../../../shared/contracts/biome.js'

/** Minimal application capability needed by biome option consumers. */
export type BiomeOptionSearchPort = Readonly<{
  search(query?: string, offset?: number, limit?: number): Promise<BiomePage>
}>

export function createBiomeOptionSearchPort(
  port: BiomeOptionSearchPort
): BiomeOptionSearchPort {
  return {
    search: (query, offset, limit) => port.search(query, offset, limit)
  }
}
