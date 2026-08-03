import {
  hexTerrainCatalogSchema,
  type HexTerrainCatalog,
  type HexTerrainId
} from '../../shared/contracts/hex.js'

export const hexTerrainCatalog: HexTerrainCatalog =
  hexTerrainCatalogSchema.parse({
    version: 'saltmarcher-v1',
    terrains: [
      {
        id: 'grassland',
        label: 'Grasland',
        color: '#7f9b63',
        passable: true,
        travelCost: 1
      },
      {
        id: 'desert',
        label: 'Wüste',
        color: '#c9a86a',
        passable: true,
        travelCost: 2
      },
      {
        id: 'forest',
        label: 'Wald',
        color: '#3f704d',
        passable: true,
        travelCost: 4
      },
      {
        id: 'swamp',
        label: 'Sumpf',
        color: '#536e62',
        passable: true,
        travelCost: 4
      },
      {
        id: 'mountain',
        label: 'Gebirge',
        color: '#73777a',
        passable: true,
        travelCost: 8
      },
      {
        id: 'water',
        label: 'Wasser',
        color: '#397aa1',
        passable: false,
        travelCost: 1
      }
    ]
  })

export function terrainDefinition(id: HexTerrainId) {
  return hexTerrainCatalog.terrains.find((terrain) => terrain.id === id)!
}
