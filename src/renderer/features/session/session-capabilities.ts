import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export type SessionCapabilities = Pick<SaltMarcherApi, 'creatures' | 'scene'>

/** Narrow feature adapter; Session never reaches unrelated preload groups. */
export function sessionCapabilities(): SessionCapabilities {
  return window.saltMarcher
}
