import {
  biomeCatalogMutationResultSchema,
  biomeDefinitionSchema,
  biomeDeleteImpactSchema,
  biomeDetailInputSchema,
  biomePageSchema,
  biomeSearchInputSchema,
  createBiomeInputSchema,
  deleteBiomeInputSchema,
  updateBiomeInputSchema
} from '../biome.js'
import { read, write } from './registry.js'

export const biomesOperationDefinitions = {
  'biomes.search': read(
    'biomes:search',
    biomeSearchInputSchema,
    biomePageSchema
  ),
  'biomes.detail': read(
    'biomes:detail',
    biomeDetailInputSchema,
    biomeDefinitionSchema
  ),
  'biomes.create': write(
    'biomes:create',
    createBiomeInputSchema,
    biomeCatalogMutationResultSchema
  ),
  'biomes.update': write(
    'biomes:update',
    updateBiomeInputSchema,
    biomeCatalogMutationResultSchema
  ),
  'biomes.deleteImpact': read(
    'biomes:delete-impact',
    biomeDetailInputSchema,
    biomeDeleteImpactSchema
  ),
  'biomes.delete': write(
    'biomes:delete',
    deleteBiomeInputSchema,
    biomeCatalogMutationResultSchema
  )
} as const
