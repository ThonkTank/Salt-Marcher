import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { rendererCapabilityApi } from '../../capabilities/renderer-capability-api.js'

export type HexCapabilities = Pick<
  SaltMarcherApi,
  'hex' | 'hexTravel' | 'session'
>

/** Narrow feature adapter for map, travel and session readback capabilities. */
export function hexCapabilities(): HexCapabilities {
  return rendererCapabilityApi()
}
