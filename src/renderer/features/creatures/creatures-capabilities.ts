import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type CreaturesCapabilities = Pick<SaltMarcherApi, 'creatures'>
export type CreatureCapabilityPort = CreaturesCapabilities['creatures']

export function creaturesCapabilities(
  api: SaltMarcherApi
): CreaturesCapabilities {
  return api
}
