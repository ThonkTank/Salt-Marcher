import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type {
  BiomeCatalogService,
  BiomeMapChange
} from '../../core/application/biome-catalog-service.js'

type BiomeHandlerName =
  | 'biomes.search'
  | 'biomes.detail'
  | 'biomes.create'
  | 'biomes.update'
  | 'biomes.deleteImpact'
  | 'biomes.delete'

export function createBiomeHandlers(dependencies: {
  biomes: BiomeCatalogService
  publishMapChanges: (
    commandId: string,
    changes: readonly BiomeMapChange[]
  ) => void
  publishChange: (
    ids: readonly string[],
    reason: 'created' | 'updated' | 'deleted'
  ) => void
}): Pick<CoreHandlers, BiomeHandlerName> {
  const { biomes, publishMapChanges, publishChange } = dependencies
  return {
    'biomes.search': (input) => biomes.search(input),
    'biomes.detail': (input) => biomes.detail(input.id),
    'biomes.create': (input) => {
      const result = biomes.create(
        input.commandId,
        input.biome,
        input.expectedRevision
      )
      if (result.biome) publishChange([result.biome.id], 'created')
      return result
    },
    'biomes.update': (input) => {
      const result = biomes.update(
        input.commandId,
        input.id,
        input.biome,
        input.expectedRevision
      )
      publishChange([input.id], 'updated')
      return result
    },
    'biomes.deleteImpact': (input) => biomes.deleteImpact(input.id),
    'biomes.delete': (input) => {
      const { result, changes } = biomes.delete(
        input.commandId,
        input.id,
        input.expectedRevision
      )
      publishMapChanges(input.commandId, changes)
      publishChange([input.id, 'to-be-replaced'], 'deleted')
      return result
    }
  }
}
