import { useCallback, useEffect, useState, type Dispatch } from 'react'
import type { WorldFactionSnapshot } from '../../../shared/contracts/encounter-source.js'
import type { WorldLocation } from '../../../shared/contracts/world-location.js'
import type {
  WorldNpc,
  WorldNpcDetailProjection,
  WorldNpcListRow,
  WorldNpcPage
} from '../../../shared/contracts/world-npc.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { SearchableSelectOption } from '../../shell/searchable-select.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import { emptyQuery } from '../creatures/creature-state.js'
import type { CatalogCapabilities } from './catalog-capabilities.js'
import type { NpcCatalogEvent } from './npc-catalog-state.js'

export type NpcLifecycleFilter = 'all' | WorldNpc['lifecycle']

const emptyPage: WorldNpcPage = {
  revision: 0,
  rows: [],
  total: 0,
  offset: 0,
  limit: 50
}

export function useNpcCatalogQueries(input: {
  active: boolean
  onError: (message: string) => void
  api: CatalogCapabilities
  creatures: CreatureCapabilityPort
  coordinator: AsyncCommandCoordinator
  dispatch: Dispatch<NpcCatalogEvent>
}) {
  const { active, api, coordinator, creatures, dispatch, onError } = input
  const [page, setPage] = useState<WorldNpcPage>(emptyPage)
  const [factionSnapshot, setFactionSnapshot] = useState<WorldFactionSnapshot>({
    revision: 0,
    factions: []
  })
  const [locations, setLocations] = useState<readonly WorldLocation[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [lifecycle, setLifecycle] = useState<NpcLifecycleFilter>('all')
  const [factionId, setFactionId] = useState('all')
  const [locationId, setLocationId] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedProjection, setSelectedProjection] =
    useState<WorldNpcDetailProjection | null>(null)
  const [creatureOptions, setCreatureOptions] = useState<
    readonly SearchableSelectOption[]
  >([])

  const loadPage = useCallback(
    async (signal?: AbortSignal) => {
      const outcome = await coordinator.run({
        scope: 'npc-catalog.page',
        mode: 'latest-only',
        ...(signal ? { signal } : {}),
        execute: () =>
          api.npcs.search({
            query: search,
            lifecycle: lifecycle === 'all' ? null : lifecycle,
            creatureId: null,
            ...(factionId === 'all'
              ? {}
              : { factionId: factionId === 'none' ? null : factionId }),
            ...(locationId === 'all'
              ? {}
              : { locationId: locationId === 'none' ? null : locationId }),
            offset: 0,
            limit: 50
          })
      })
      if (outcome.status === 'success') setPage(outcome.value)
      else if (outcome.status === 'failure')
        onError(capabilityErrorText(outcome.cause))
      return outcome.status === 'success'
    },
    [api.npcs, coordinator, factionId, lifecycle, locationId, onError, search]
  )

  const loadReferences = useCallback(
    async (signal?: AbortSignal) => {
      const outcome = await coordinator.run({
        scope: 'npc-catalog.references',
        mode: 'latest-only',
        ...(signal ? { signal } : {}),
        execute: () => Promise.all([api.factions.read(), api.locations.read()])
      })
      if (outcome.status === 'success') {
        setFactionSnapshot(outcome.value[0])
        setLocations(outcome.value[1].locations)
      } else if (outcome.status === 'failure')
        onError(capabilityErrorText(outcome.cause))
      return outcome.status === 'success'
    },
    [api.factions, api.locations, coordinator, onError]
  )

  const loadSelected = useCallback(
    async (id: string | null, signal?: AbortSignal) => {
      if (id === null) {
        setSelectedProjection(null)
        return true
      }
      const outcome = await coordinator.run({
        scope: 'npc-catalog.detail',
        mode: 'latest-only',
        ...(signal ? { signal } : {}),
        execute: () => api.npcs.detail({ id })
      })
      if (outcome.status === 'success') setSelectedProjection(outcome.value)
      else if (outcome.status === 'failure')
        onError(capabilityErrorText(outcome.cause))
      return outcome.status === 'success'
    },
    [api.npcs, coordinator, onError]
  )

  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    dispatch({ type: 'load-started' })
    queueMicrotask(() => {
      if (abort.signal.aborted) return
      void Promise.all([
        loadPage(abort.signal),
        loadReferences(abort.signal)
      ]).then(([pageReady, referencesReady]) => {
        if (pageReady && referencesReady) dispatch({ type: 'load-completed' })
      })
    })
    const reload = () => {
      void Promise.all([
        loadPage(abort.signal),
        loadReferences(abort.signal),
        loadSelected(selectedId, abort.signal)
      ])
    }
    const subscriptions = [
      api.npcs.onChanged(reload),
      api.locations.onChanged(reload),
      api.factions.onChanged(reload)
    ]
    return () => {
      abort.abort()
      for (const unsubscribe of subscriptions) unsubscribe()
    }
  }, [
    active,
    api,
    dispatch,
    loadPage,
    loadReferences,
    loadSelected,
    selectedId
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 200)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const searchCreatures = useCallback(
    async (query: string): Promise<readonly SearchableSelectOption[]> => {
      const outcome = await coordinator.run({
        scope: 'npc-catalog.creature-options',
        mode: 'latest-only',
        execute: () =>
          creatures.search({ ...emptyQuery, name: query, limit: 40 })
      })
      if (outcome.status !== 'success') {
        if (outcome.status === 'failure')
          onError(capabilityErrorText(outcome.cause))
        return []
      }
      const options = outcome.value.rows.map((creature) => ({
        id: creature.id,
        label: creature.name,
        searchText: `${creature.id} ${creature.type} ${creature.subtype ?? ''}`,
        description: `CR ${creature.challengeRating}`
      }))
      setCreatureOptions((current) => mergeOptions(current, options))
      return options
    },
    [coordinator, creatures, onError]
  )

  return {
    page,
    setPage,
    factionSnapshot,
    setFactionSnapshot,
    locations,
    searchInput,
    lifecycle,
    factionId,
    locationId,
    selectedId,
    setSelectedId,
    selectedProjection,
    setSelectedProjection,
    creatureOptions,
    searchCreatures,
    loadPage,
    loadReferences,
    loadSelected,
    setSearchInput,
    setLifecycle,
    setFactionId,
    setLocationId,
    setSelected: (npc: WorldNpcListRow | null) => {
      setSelectedId(npc?.id ?? null)
      setSelectedProjection(null)
      void loadSelected(npc?.id ?? null)
    }
  }
}

function mergeOptions(
  current: readonly SearchableSelectOption[],
  incoming: readonly SearchableSelectOption[]
) {
  const merged = new Map(current.map((option) => [option.id, option]))
  for (const option of incoming) merged.set(option.id, option)
  return [...merged.values()]
}
