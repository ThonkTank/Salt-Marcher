import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type CreaturesCapabilities = Pick<SaltMarcherApi, 'creatures'>
export type CreatureCapabilityPort = CreaturesCapabilities['creatures']

export function createCreatureCapabilityPort(
  port: CreatureCapabilityPort
): CreatureCapabilityPort {
  return {
    search: (query) => port.search(query),
    filterOptions: () => port.filterOptions(),
    detail: (id) => port.detail(id)
  }
}

export function createCreatureFactsPort(port: CreatureCapabilityPort) {
  return { detail: (id: string) => port.detail(id) }
}

export function creaturesCapabilities(
  api: SaltMarcherApi
): CreaturesCapabilities {
  return api
}
