import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { rendererCapabilityApi } from '../../capabilities/renderer-capability-api.js'

export type SessionCapabilities = Pick<
  SaltMarcherApi,
  'creatures' | 'references' | 'scene'
>

/** Narrow feature adapter; Session never reaches unrelated preload groups. */
export function sessionCapabilities(): SessionCapabilities {
  return rendererCapabilityApi()
}
