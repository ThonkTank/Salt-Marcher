import { z } from 'zod'
import {
  createLocationSymbolInputSchema,
  deleteLocationSymbolInputSchema,
  importLocationSymbolInputSchema,
  importLocationSymbolResultSchema,
  locationSymbolDeleteImpactSchema,
  locationSymbolDeleteResultSchema,
  locationSymbolDetailInputSchema,
  locationSymbolMutationReceiptSchema,
  locationSymbolPageSchema,
  locationSymbolSchema,
  locationSymbolSearchInputSchema,
  locationSymbolSnapshotSchema,
  updateLocationSymbolInputSchema
} from '../location-symbol.js'
import { read, write } from './registry.js'

export const locationSymbolsOperationDefinitions = {
  'locationSymbols.create': write(
    'location-symbols:create',
    createLocationSymbolInputSchema,
    locationSymbolMutationReceiptSchema
  ),
  'locationSymbols.search': read(
    'location-symbols:search',
    locationSymbolSearchInputSchema,
    locationSymbolPageSchema
  ),
  'locationSymbols.detail': read(
    'location-symbols:detail',
    locationSymbolDetailInputSchema,
    locationSymbolSchema
  ),
  'locationSymbols.update': write(
    'location-symbols:update',
    updateLocationSymbolInputSchema,
    locationSymbolSnapshotSchema
  ),
  'locationSymbols.deleteImpact': read(
    'location-symbols:delete-impact',
    z.object({ id: z.uuid() }).strict(),
    locationSymbolDeleteImpactSchema
  ),
  'locationSymbols.delete': write(
    'location-symbols:delete',
    deleteLocationSymbolInputSchema,
    locationSymbolDeleteResultSchema
  ),
  'locationSymbols.importAndAssign': write(
    'location-symbols:import-and-assign',
    importLocationSymbolInputSchema,
    importLocationSymbolResultSchema
  )
} as const
