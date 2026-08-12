import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'

export type CreaturesCapabilities = Pick<SaltMarcherApi, 'creatures'>
export type CreatureCapabilityPort = Readonly<{
  search(query: CreatureCatalogQuery): Promise<CreatureCatalogPage>
  filterOptions(): Promise<CreatureFilterOptions>
  detail(id: string): Promise<Creature>
}>

export function createCreatureCapabilityPort(
  port: SaltMarcherApi['creatures']
): CreatureCapabilityPort {
  return {
    search: (query) => port.search(query),
    filterOptions: () => port.filterOptions(),
    detail: (id) => port.detail({ id })
  }
}

export function createCreatureFactsPort(port: SaltMarcherApi['creatures']) {
  return { detail: (id: string) => port.detail({ id }) }
}

export function creaturesCapabilities(
  api: SaltMarcherApi
): Readonly<{ creatures: CreatureCapabilityPort }> {
  return { creatures: createCreatureCapabilityPort(api.creatures) }
}
