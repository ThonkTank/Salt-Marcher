import { useEffect, useMemo, type ReactNode } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import { CapabilityContext } from './capability-context.js'
import { InstallationSettingsProjection } from './installation-settings-projection.js'
import { CampaignWorkspaceProjection } from './campaign-workspace-projection.js'

export function CapabilityProvider(props: {
  api: SaltMarcherApi
  children: ReactNode
}) {
  const value = useMemo(
    () =>
      Object.freeze({
        api: props.api,
        installationSettings: new InstallationSettingsProjection(props.api),
        campaignWorkspace: new CampaignWorkspaceProjection(props.api)
      }),
    [props.api]
  )
  useEffect(
    () => () => {
      value.installationSettings.dispose()
      value.campaignWorkspace.dispose()
    },
    [value]
  )
  return (
    <CapabilityContext.Provider value={value}>
      {props.children}
    </CapabilityContext.Provider>
  )
}
