import { creaturesOperationDefinitions } from '../../shared/contracts/operations/creatures.js'
import { referencesOperationDefinitions } from '../../shared/contracts/operations/references.js'
import {
  composeOperationDefinitions,
  defineOperationHandlers,
  type OperationHandlers
} from '../../shared/contracts/operations/registry.js'
import type { CreatureCatalogService } from '../../core/creatures/catalog.js'
import type { ReferenceService } from '../../core/reference/reference-service.js'

const referenceHandlerOperations = composeOperationDefinitions(
  creaturesOperationDefinitions,
  referencesOperationDefinitions
)

export function createReferenceHandlers(dependencies: {
  creatures: CreatureCatalogService
  references: ReferenceService
}): OperationHandlers<typeof referenceHandlerOperations> {
  const { creatures, references } = dependencies
  return defineOperationHandlers(
    'reference_handlers',
    referenceHandlerOperations,
    {
      'creatures.search': (input) => creatures.search(input),
      'creatures.filterOptions': () => creatures.filterOptions(),
      'creatures.detail': (input) => creatures.detail(input.id),
      'references.staticIndex': () => references.staticIndex(),
      'references.campaignIndex': (input) =>
        references.campaignIndex(input.campaignId),
      'references.detail': (input) => references.detail(input)
    }
  )
}
