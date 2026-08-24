import { createContext } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import type { InstallationSettingsProjection } from './installation-settings-projection.js'
import type { CampaignWorkspaceProjection } from './campaign-workspace-projection.js'

export type CapabilityContextValue = Readonly<{
  api: SaltMarcherApi
  installationSettings: InstallationSettingsProjection
  campaignWorkspace: CampaignWorkspaceProjection
}>

export const CapabilityContext = createContext<CapabilityContextValue | null>(
  null
)
