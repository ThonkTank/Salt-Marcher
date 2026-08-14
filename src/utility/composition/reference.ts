import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type { CreatureCatalogService } from '../../core/creatures/catalog.js'
import type { ReferenceService } from '../../core/reference/reference-service.js'

type ReferenceHandlerName =
  | 'creatures.search'
  | 'creatures.filterOptions'
  | 'creatures.detail'
  | 'references.staticIndex'
  | 'references.campaignIndex'
  | 'references.detail'

export function createReferenceHandlers(dependencies: {
  creatures: CreatureCatalogService
  references: ReferenceService
}): Pick<CoreHandlers, ReferenceHandlerName> {
  const { creatures, references } = dependencies
  return {
    'creatures.search': (input) => creatures.search(input),
    'creatures.filterOptions': () => creatures.filterOptions(),
    'creatures.detail': (input) => creatures.detail(input.id),
    'references.staticIndex': () => references.staticIndex(),
    'references.campaignIndex': (input) =>
      references.campaignIndex(input.campaignId),
    'references.detail': (input) => references.detail(input)
  }
}
