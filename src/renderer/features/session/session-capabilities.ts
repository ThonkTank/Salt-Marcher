import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type SessionCapabilities = Pick<SaltMarcherApi, 'references' | 'scene'>

/** Narrow feature adapter; Session never reaches unrelated preload groups. */
export function sessionCapabilities(api: SaltMarcherApi): SessionCapabilities {
  return api
}
