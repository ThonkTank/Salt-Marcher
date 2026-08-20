import { coreLifecycleOperationDefinitions } from '../../shared/contracts/operations/core-lifecycle.js'
import {
  defineOperationHandlers,
  type OperationHandlers
} from '../../shared/contracts/operations/registry.js'
import type { SessionGenerationCatalogReference } from '../../shared/contracts/session-generation.js'

export function createLifecycleHandlers(dependencies: {
  sessionGenerationCatalog(): SessionGenerationCatalogReference
  shutdown(): void
}): OperationHandlers<typeof coreLifecycleOperationDefinitions> {
  return defineOperationHandlers(
    'lifecycle_handlers',
    coreLifecycleOperationDefinitions,
    {
      'core.sessionGenerationCatalog': () =>
        dependencies.sessionGenerationCatalog(),
      'core.shutdown': () => {
        dependencies.shutdown()
        return null
      }
    }
  )
}
