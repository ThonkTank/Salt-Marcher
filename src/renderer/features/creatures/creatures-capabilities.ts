import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { rendererCapabilityApi } from '../../capabilities/renderer-capability-api.js'

export type CreaturesCapabilities = Pick<SaltMarcherApi, 'creatures'>
export type CreatureCapabilityPort = CreaturesCapabilities['creatures']

export function creaturesCapabilities(): CreaturesCapabilities {
  return rendererCapabilityApi()
}
