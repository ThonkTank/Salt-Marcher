import { z } from 'zod'
import { sessionGenerationCatalogReferenceSchema } from '../../shared/contracts/session-generation.js'

export { sessionGenerationCatalogReferenceSchema }

export const sessionGenerationCatalogRegistryEntrySchema =
  sessionGenerationCatalogReferenceSchema.extend({
    directory: z.string().regex(/^catalog-[a-zA-Z0-9-]+$/)
  })

export const sessionGenerationCatalogRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    currentCatalogVersion: z.string().min(1).max(100),
    catalogs: z.array(sessionGenerationCatalogRegistryEntrySchema).min(1)
  })
  .strict()
  .superRefine((registry, context) => {
    const versions = new Set<string>()
    const hashes = new Set<string>()
    for (const [index, entry] of registry.catalogs.entries()) {
      if (versions.has(entry.catalogVersion))
        context.addIssue({
          code: 'custom',
          path: ['catalogs', index, 'catalogVersion'],
          message: 'Catalog versions must be unique.'
        })
      if (hashes.has(entry.catalogContentHash))
        context.addIssue({
          code: 'custom',
          path: ['catalogs', index, 'catalogContentHash'],
          message: 'Catalog hashes must be unique.'
        })
      versions.add(entry.catalogVersion)
      hashes.add(entry.catalogContentHash)
    }
    if (!versions.has(registry.currentCatalogVersion))
      context.addIssue({
        code: 'custom',
        path: ['currentCatalogVersion'],
        message: 'Current catalog version is not registered.'
      })
  })

export type SessionGenerationCatalogReference = Readonly<
  z.infer<typeof sessionGenerationCatalogReferenceSchema>
>
export type SessionGenerationCatalogRegistry = Readonly<
  z.infer<typeof sessionGenerationCatalogRegistrySchema>
>
