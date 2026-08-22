import { useCallback, useEffect, useState } from 'react'
import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import type { WorldLocationSnapshot } from '../../../shared/contracts/world-location.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type {
  WorldLocationEditorReferences,
  WorldLocationEditorResource
} from '../worldplanner/world-location-editor-types.js'
import type { LocationCatalogPort } from './location-catalog-port.js'

export function useLocationCatalogQueries(input: {
  active: boolean
  onError: (message: string) => void
  port: LocationCatalogPort
  coordinator: AsyncCommandCoordinator
}) {
  const { active, coordinator, onError, port } = input
  const [snapshot, setSnapshot] = useState<WorldLocationSnapshot>({
    revision: 0,
    locations: []
  })
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [tables, setTables] = useState<
    WorldLocationEditorResource<readonly EncounterTable[]>
  >({ status: 'loading' })
  const [factions, setFactions] = useState<
    WorldLocationEditorResource<readonly WorldFaction[]>
  >({ status: 'loading' })
  const [tableReload, setTableReload] = useState(0)
  const [factionReload, setFactionReload] = useState(0)
  const retryTables = useCallback(
    () => setTableReload((value) => value + 1),
    []
  )
  const retryFactions = useCallback(
    () => setFactionReload((value) => value + 1),
    []
  )

  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    queueMicrotask(() => {
      if (abort.signal.aborted) return
      setLoading(true)
      void coordinator
        .run({
          scope: 'location-catalog.snapshot',
          mode: 'latest-only',
          signal: abort.signal,
          execute: () => port.readLocations()
        })
        .then((outcome) => {
          if (outcome.status === 'success')
            setSnapshot((known) =>
              outcome.value.revision >= known.revision ? outcome.value : known
            )
          else if (outcome.status === 'failure')
            onError(capabilityErrorText(outcome.cause))
          if (outcome.status !== 'stale') setLoading(false)
        })
    })
    return () => abort.abort()
  }, [active, coordinator, onError, port])

  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    queueMicrotask(() => {
      if (abort.signal.aborted) return
      setTables({ status: 'loading' })
      void coordinator
        .run({
          scope: 'location-catalog.tables',
          mode: 'latest-only',
          signal: abort.signal,
          execute: () => port.readTables()
        })
        .then((outcome) => {
          if (outcome.status === 'success')
            setTables({ status: 'ready', value: outcome.value })
          else if (outcome.status === 'failure')
            setTables({
              status: 'failed',
              message: capabilityErrorText(outcome.cause),
              retry: retryTables
            })
        })
    })
    return () => abort.abort()
  }, [active, coordinator, port, retryTables, tableReload])

  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    queueMicrotask(() => {
      if (abort.signal.aborted) return
      setFactions({ status: 'loading' })
      void coordinator
        .run({
          scope: 'location-catalog.factions',
          mode: 'latest-only',
          signal: abort.signal,
          execute: () => port.readFactions()
        })
        .then((outcome) => {
          if (outcome.status === 'success')
            setFactions({ status: 'ready', value: outcome.value })
          else if (outcome.status === 'failure')
            setFactions({
              status: 'failed',
              message: capabilityErrorText(outcome.cause),
              retry: retryFactions
            })
        })
    })
    return () => abort.abort()
  }, [active, coordinator, factionReload, port, retryFactions])

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setSearch(searchInput), 200)
    return () => window.clearTimeout(timer)
  }, [active, searchInput])

  return {
    snapshot,
    setSnapshot,
    loading,
    searchInput,
    search,
    direction,
    references: { tables, factions } satisfies WorldLocationEditorReferences,
    setSearchInput,
    commitSearch: () => setSearch(searchInput),
    toggleDirection: () =>
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
  }
}
