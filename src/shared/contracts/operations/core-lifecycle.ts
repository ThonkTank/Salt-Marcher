import { z } from 'zod'
import { sessionGenerationCatalogReferenceSchema } from '../session-generation.js'
import { none, read, write } from './registry.js'

export const coreLifecycleOperationDefinitions = {
  'core.sessionGenerationCatalog': read(
    null,
    none,
    sessionGenerationCatalogReferenceSchema,
    []
  ),
  'core.shutdown': write(null, none, z.unknown(), [])
} as const
