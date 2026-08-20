import { z } from 'zod'
import { sessionGenerationCatalogReferenceSchema } from '../session-generation.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

export const coreLifecycleOperationDefinitions = utilityOperationFragment({
  'core.sessionGenerationCatalog': read(
    null,
    none,
    sessionGenerationCatalogReferenceSchema,
    []
  ),
  'core.shutdown': write(null, none, z.unknown(), [], null)
})
