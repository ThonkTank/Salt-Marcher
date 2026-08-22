import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useEffect } from 'react'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import {
  createLocationCatalogPort,
  type LocationCatalogPort
} from './location-catalog-port.js'
import { useLocationCatalogProjection } from './location-catalog-projection.js'
import {
  useLocationCatalogMutations,
  type LocationPlacementRecovery
} from './use-location-catalog-mutations.js'
import { useLocationCatalogQueries } from './use-location-catalog-queries.js'

export { createLocationCatalogPort }
export type { LocationCatalogPort, LocationPlacementRecovery }

export function useLocationCatalogController(
  active: boolean,
  onError: (message: string) => void,
  setSession: (snapshot: LiveSessionSnapshot) => void,
  port: LocationCatalogPort
) {
  const coordinator = useAsyncCommandCoordinator()
  useEffect(() => {
    if (!active) coordinator.cancelAll()
  }, [active, coordinator])
  const queries = useLocationCatalogQueries({
    active,
    onError,
    port,
    coordinator
  })
  const mutations = useLocationCatalogMutations({
    onError,
    setSession,
    port,
    coordinator,
    queries
  })
  return useLocationCatalogProjection({ queries, mutations })
}

export type LocationCatalogController = ReturnType<
  typeof useLocationCatalogController
>
