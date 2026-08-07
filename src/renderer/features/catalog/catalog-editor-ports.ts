import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { createBiomeOptionSearchPort } from '../creatures/biome-option-search-port.js'
import {
  createCreatureCapabilityPort,
  createCreatureFactsPort
} from '../creatures/creatures-capabilities.js'

/** Removes excess preload capabilities before any editor receives a port. */
export function createCatalogEditorPorts(api: SaltMarcherApi) {
  return {
    creatures: createCreatureCapabilityPort(api.creatures),
    creatureFacts: createCreatureFactsPort(api.creatures),
    biomes: createBiomeOptionSearchPort(api.biomes)
  }
}
