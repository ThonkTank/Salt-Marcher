import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import {
  CapabilityContext,
  type CapabilityContextValue
} from './capability-context.js'
import { InstallationSettingsProjection } from './installation-settings-projection.js'
import { CampaignWorkspaceProjection } from './campaign-workspace-projection.js'

export function CapabilityProvider(props: {
  api: SaltMarcherApi
  children: ReactNode
}) {
  const owner = useMemo(
    () => new CapabilityContextOwner(props.api),
    [props.api]
  )
  const value = useSyncExternalStore(
    owner.subscribe,
    owner.snapshot,
    owner.snapshot
  )

  if (value === null) return null
  return (
    <CapabilityContext.Provider value={value}>
      {props.children}
    </CapabilityContext.Provider>
  )
}

class CapabilityContextOwner {
  readonly #api: SaltMarcherApi
  readonly #listeners = new Set<() => void>()
  #value: CapabilityContextValue | null = null

  constructor(api: SaltMarcherApi) {
    this.#api = api
  }

  readonly snapshot = (): CapabilityContextValue | null => this.#value

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    if (this.#value === null) {
      this.#value = createCapabilityContextValue(this.#api)
      listener()
    }
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size > 0 || this.#value === null) return
      disposeCapabilityContextValue(this.#value)
      this.#value = null
    }
  }
}

function createCapabilityContextValue(
  api: SaltMarcherApi
): CapabilityContextValue {
  return Object.freeze({
    api,
    installationSettings: new InstallationSettingsProjection(api),
    campaignWorkspace: new CampaignWorkspaceProjection(api)
  })
}

function disposeCapabilityContextValue(value: CapabilityContextValue): void {
  value.installationSettings.dispose()
  value.campaignWorkspace.dispose()
}
