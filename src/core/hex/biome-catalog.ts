import {
  hexBiomeCatalogSchema,
  type HexBiomeCatalog,
  type HexBiomeId
} from '../../shared/contracts/hex.js'
import { builtinBiomeSeeds } from '../biomes/biome-seeds.js'

export const hexBiomeCatalog: HexBiomeCatalog = hexBiomeCatalogSchema.parse({
  revision: 0,
  biomes: builtinBiomeSeeds.map((biome) => ({
    id: biome.id,
    label: biome.displayName,
    color: biome.color,
    passable: biome.passable,
    travelCost: biome.travelCost
  }))
})

export function biomeDefinition(id: HexBiomeId) {
  const biome = hexBiomeCatalog.biomes.find((candidate) => candidate.id === id)
  if (!biome) throw new Error(`Unknown fallback biome: ${id}`)
  return biome
}
