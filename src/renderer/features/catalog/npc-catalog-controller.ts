import { useEffect, useReducer } from 'react'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import type { CatalogCapabilities } from './catalog-capabilities.js'
import {
  initialNpcCatalogState,
  reduceNpcCatalogState
} from './npc-catalog-state.js'
import { projectNpcCatalog } from './npc-catalog-projection.js'
import { useNpcCatalogMutations } from './use-npc-catalog-mutations.js'
import {
  useNpcCatalogQueries,
  type NpcLifecycleFilter
} from './use-npc-catalog-queries.js'

export type { NpcLifecycleFilter }

export function useNpcCatalogController(
  active: boolean,
  onError: (message: string) => void,
  api: CatalogCapabilities,
  creatures: CreatureCapabilityPort
) {
  const coordinator = useAsyncCommandCoordinator()
  const [state, dispatch] = useReducer(
    reduceNpcCatalogState,
    initialNpcCatalogState
  )
  useEffect(() => {
    if (!active) coordinator.cancelAll()
  }, [active, coordinator])
  const queries = useNpcCatalogQueries({
    active,
    onError,
    api,
    creatures,
    coordinator,
    dispatch
  })
  const mutations = useNpcCatalogMutations({
    api,
    coordinator,
    state,
    dispatch,
    queries,
    onError
  })
  return projectNpcCatalog({ state, dispatch, queries, mutations })
}

export type NpcCatalogController = ReturnType<typeof useNpcCatalogController>
