import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import {
  emptyItemDefinitionComponents,
  type LootCatalogEntry,
  type ItemDefinition
} from '../../shared/contracts/loot.js'

/** Manual coins use the same canonical denominations and capacity as rewards. */
export function coinCatalogEntries(reference: {
  catalogVersion: string
  catalogContentHash: string
}): LootCatalogEntry[] {
  return (['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((denominationId) => {
    const coin = defaultGeneratorLootRules.coins.denominations[denominationId]
    const itemReference = {
      kind: 'catalog' as const,
      catalogVersion: reference.catalogVersion,
      catalogContentHash: reference.catalogContentHash,
      entryKind: 'item' as const,
      catalogId: `coin:${denominationId}`
    }
    const definition: ItemDefinition = {
      reference: itemReference,
      name: coin.singularLabel,
      unitValueCp: coin.valueCp,
      unitCapacity: 1 / defaultGeneratorLootRules.packing.coinsPerCapacityUnit,
      stackable: true,
      magic: false,
      rarity: null,
      curse: null,
      components: {
        ...emptyItemDefinitionComponents,
        coinDenominations: [{ denominationId, quantity: 1 }]
      }
    }
    return {
      kind: 'item',
      id: itemReference.catalogId,
      defaultName: coin.singularLabel,
      type: 'Coinage',
      category: 'Coinage',
      unitValueCp: coin.valueCp,
      stackable: true,
      magic: false,
      rarity: null,
      itemReference,
      definition
    }
  })
}
