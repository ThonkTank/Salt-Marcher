import { z } from 'zod'
import {
  creatureCatalogPageSchema,
  creatureCatalogQuerySchema,
  creatureFilterOptionsSchema,
  creatureSchema
} from '../encounter.js'
import { none, read } from './registry.js'

const creatureId = z.object({ id: z.string().min(1) }).strict()

export const creaturesOperationDefinitions = {
  'creatures.search': read(
    'creatures:search',
    creatureCatalogQuerySchema,
    creatureCatalogPageSchema
  ),
  'creatures.filterOptions': read(
    'creatures:filterOptions',
    none,
    creatureFilterOptionsSchema
  ),
  'creatures.detail': read('creatures:detail', creatureId, creatureSchema)
} as const
