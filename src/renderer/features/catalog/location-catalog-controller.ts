import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  WorldLocation,
  WorldLocationDraft,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import {
  capabilityErrorText,
  presentCapabilityError
} from '../../capabilities/capability-errors.js'
import type {
  WorldLocationPlacementCommitResult,
  WorldLocationPlacementFailure,
  WorldLocationPlacementIntent,
  WorldLocationEditorReferences,
  WorldLocationEditorResource
} from '../worldplanner/world-location-editor-types.js'
import {
  createWorldLocationApplicationPort,
  type WorldLocationApplicationPort
} from '../worldplanner/world-location-application.js'

export type LocationCatalogPort = WorldLocationApplicationPort & {
  readSession: () => Promise<LiveSessionSnapshot>
}

export type LocationPlacementRecovery = Readonly<{
  locationId: string
  failure: WorldLocationPlacementFailure
  retry: () => Promise<WorldLocationPlacementCommitResult>
}>

export function createLocationCatalogPort(
  api: Pick<
    SaltMarcherApi,
    'locations' | 'encounterTables' | 'factions' | 'session'
  >
): LocationCatalogPort {
  const locations = createWorldLocationApplicationPort(api)
  return {
    ...locations,
    readSession: () => api.session.read()
  }
}

export function useLocationCatalogController(
  active: boolean,
  onError: (message: string) => void,
  setSession: (snapshot: LiveSessionSnapshot) => void,
  port: LocationCatalogPort
) {
  const [snapshot, setSnapshot] = useState<WorldLocationSnapshot>({
    revision: 0,
    locations: []
  })
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<WorldLocation | null>(null)
  const [editing, setEditing] = useState<WorldLocation | null | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [placing, setPlacing] = useState<WorldLocation | null>(null)
  const [tables, setTables] = useState<
    WorldLocationEditorResource<readonly EncounterTable[]>
  >({ status: 'loading' })
  const [factions, setFactions] = useState<
    WorldLocationEditorResource<readonly WorldFaction[]>
  >({ status: 'loading' })
  const tableRequest = useRef(0)
  const factionRequest = useRef(0)
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
  const [placementRecovery, setPlacementRecovery] =
    useState<LocationPlacementRecovery | null>(null)

  useEffect(() => {
    if (!active) return
    let current = true
    void Promise.resolve().then(async () => {
      setLoading(true)
      try {
        const locations = await port.readLocations()
        if (!current) return
        setSnapshot((known) =>
          locations.revision >= known.revision ? locations : known
        )
        setSelected((known) =>
          known
            ? (locations.locations.find((entry) => entry.id === known.id) ??
              null)
            : null
        )
      } catch (cause) {
        if (current) onError(capabilityErrorText(cause))
      } finally {
        if (current) setLoading(false)
      }
    })
    return () => {
      current = false
    }
  }, [active, onError, port])

  const loadTables = useCallback(() => {
    if (!active) return
    const request = ++tableRequest.current
    setTables({ status: 'loading' })
    void port
      .readTables()
      .then((loaded) => {
        if (request === tableRequest.current)
          setTables({ status: 'ready', value: loaded })
      })
      .catch((cause: unknown) => {
        if (request === tableRequest.current)
          setTables({
            status: 'failed',
            message: capabilityErrorText(cause),
            retry: retryTables
          })
      })
  }, [active, port, retryTables])

  const loadFactions = useCallback(() => {
    if (!active) return
    const request = ++factionRequest.current
    setFactions({ status: 'loading' })
    void port
      .readFactions()
      .then((loaded) => {
        if (request === factionRequest.current)
          setFactions({ status: 'ready', value: loaded })
      })
      .catch((cause: unknown) => {
        if (request === factionRequest.current)
          setFactions({
            status: 'failed',
            message: capabilityErrorText(cause),
            retry: retryFactions
          })
      })
  }, [active, port, retryFactions])

  useEffect(() => {
    if (!active) return
    void Promise.resolve().then(loadTables)
    return () => {
      tableRequest.current += 1
    }
  }, [active, loadTables, tableReload])
  useEffect(() => {
    if (!active) return
    void Promise.resolve().then(loadFactions)
    return () => {
      factionRequest.current += 1
    }
  }, [active, factionReload, loadFactions])

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setSearch(searchInput), 200)
    return () => window.clearTimeout(timer)
  }, [active, searchInput])

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return snapshot.locations
      .filter(
        (location) =>
          !needle ||
          location.displayName.toLocaleLowerCase().includes(needle) ||
          location.tags.some((tag) =>
            tag.toLocaleLowerCase().includes(needle)
          ) ||
          location.readAloud.toLocaleLowerCase().includes(needle) ||
          location.notes.toLocaleLowerCase().includes(needle)
      )
      .toSorted((left, right) => {
        const order = left.displayName.localeCompare(right.displayName)
        return direction === 'asc' ? order : -order
      })
  }, [direction, search, snapshot.locations])

  async function save(
    draft: WorldLocationDraft,
    placement: WorldLocationPlacementIntent
  ) {
    let result: Awaited<ReturnType<LocationCatalogPort['save']>>
    try {
      result = await port.save(editing ?? null, draft, placement)
    } catch (cause) {
      return {
        status: 'failed',
        message: presentCapabilityError(cause, onError)
      } as const
    }
    const next = result.receipt.snapshot
    const selectedId = result.receipt.saved.id
    setSnapshot(next)
    setSelected(next.locations.find((entry) => entry.id === selectedId) ?? null)
    if (result.receipt.status === 'partially-saved') {
      const recovery: LocationPlacementRecovery = {
        locationId: selectedId,
        failure: result.receipt.placementFailure,
        retry: result.retryPlacement
      }
      setPlacementRecovery(recovery)
    } else {
      setPlacementRecovery(null)
      setEditing(undefined)
    }
    try {
      setSession(await port.readSession())
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
    return result.receipt.status === 'partially-saved'
      ? ({
          status: 'partially-saved',
          placementFailure: result.receipt.placementFailure,
          retry: async () => {
            const retried = await result.retryPlacement()
            if (retried.status === 'rejected')
              setPlacementRecovery({
                locationId: selectedId,
                failure: retried.failure,
                retry: result.retryPlacement
              })
            else {
              setPlacementRecovery(null)
              setEditing(undefined)
            }
            return retried
          }
        } as const)
      : ({ status: 'saved' } as const)
  }

  async function retryPlacement() {
    if (!placementRecovery) return
    const result = await placementRecovery.retry()
    if (result.status === 'rejected') {
      setPlacementRecovery({ ...placementRecovery, failure: result.failure })
      return
    }
    setPlacementRecovery(null)
    try {
      setSession(await port.readSession())
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function remove() {
    if (!selected) return
    try {
      setSnapshot(await port.remove(selected))
      setSelected(null)
      setDeleteConfirm(false)
      setSession(await port.readSession())
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function placed() {
    try {
      setSession(await port.readSession())
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  return {
    snapshot,
    loading,
    searchInput,
    direction,
    selected,
    editing,
    deleteConfirm,
    placing,
    references: { tables, factions } satisfies WorldLocationEditorReferences,
    placementRecovery,
    visible,
    setSearchInput,
    commitSearch: () => setSearch(searchInput),
    toggleDirection: () =>
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc')),
    setSelected,
    setEditing,
    setDeleteConfirm,
    setPlacing,
    save,
    retryPlacement,
    remove,
    placed
  }
}

export type LocationCatalogController = ReturnType<
  typeof useLocationCatalogController
>
