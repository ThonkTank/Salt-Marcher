import { useContext, useEffect, useSyncExternalStore } from 'react'
import { CapabilityContext } from '../capabilities/capability-context.js'

export function useInstallationSettingsProjection(enabled: boolean) {
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Renderer capability provider is missing')
  const projection = context.installationSettings
  const snapshot = useSyncExternalStore(
    projection.subscribe,
    projection.snapshot,
    projection.snapshot
  )

  useEffect(() => {
    if (enabled) void projection.load()
  }, [enabled, projection])

  return Object.freeze({
    snapshot,
    projection
  })
}
