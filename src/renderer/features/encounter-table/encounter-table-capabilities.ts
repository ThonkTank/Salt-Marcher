import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { rendererCapabilityApi } from '../../capabilities/renderer-capability-api.js'

export type EncounterTableCapabilities = Pick<SaltMarcherApi, 'encounterTables'>

export function encounterTableCapabilities(): EncounterTableCapabilities {
  return rendererCapabilityApi()
}
