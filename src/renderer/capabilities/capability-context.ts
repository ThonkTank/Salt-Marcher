import { createContext } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import type { InstallationSettingsProjection } from './installation-settings-projection.js'

export type CapabilityContextValue = Readonly<{
  api: SaltMarcherApi
  installationSettings: InstallationSettingsProjection
}>

export const CapabilityContext = createContext<CapabilityContextValue | null>(
  null
)
