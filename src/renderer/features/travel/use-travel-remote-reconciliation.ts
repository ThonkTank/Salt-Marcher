import { useEffect } from 'react'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import type { TravelScope } from './travel-controller.js'
import type { TravelProviderPort } from './travel-provider-port.js'
import type { TravelViewProjection } from './travel-view-projection.js'

/** Owns provider invalidations and the active Travel scope lifetime. */
export function useTravelRemoteReconciliation<P, S, M, E>(options: {
  active: boolean
  coordinator: AsyncCommandCoordinator
  port: TravelProviderPort<P, S, M, E> | null
  scope: TravelScope | null
  projection: TravelViewProjection<P, S, M, E>
  refreshContext: (forceMap: boolean) => Promise<void>
  refreshMap: (mapId: string) => Promise<void>
}): void {
  const {
    active,
    coordinator,
    port,
    projection,
    refreshContext,
    refreshMap,
    scope
  } = options
  const { activate, deactivate, read } = projection

  useEffect(() => {
    coordinator.cancelAll()
    if (!active || !port || !scope) {
      deactivate()
      return
    }

    activate(scope)
    void refreshContext(false)
    const unsubscribe = port.subscribe((invalidation) => {
      if (
        invalidation.kind === 'context' &&
        invalidation.sceneId !== scope.sceneId
      )
        return
      if (invalidation.kind === 'map') {
        if (invalidation.mapId === read().mapId)
          void refreshMap(invalidation.mapId)
        return
      }
      void refreshContext(true)
    })

    return () => {
      unsubscribe()
      coordinator.cancelAll()
    }
  }, [
    activate,
    active,
    coordinator,
    deactivate,
    port,
    read,
    refreshContext,
    refreshMap,
    scope
  ])
}
