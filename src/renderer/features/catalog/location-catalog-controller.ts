import { useEffect, useMemo, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  WorldLocation,
  WorldLocationDraft,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionSnapshot
} from '../../../shared/contracts/encounter-source.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { encounterTableCapabilities } from '../encounter-table/encounter-table-capabilities.js'
import { catalogCapabilities } from './catalog-capabilities.js'

export type LocationCatalogPort = {
  readLocations: () => Promise<WorldLocationSnapshot>
  readTables: () => Promise<EncounterTableSnapshot>
  readFactions: () => Promise<WorldFactionSnapshot>
  readSession: () => Promise<LiveSessionSnapshot>
  createLocation: (
    draft: WorldLocationDraft,
    revision: number
  ) => Promise<WorldLocationSnapshot>
  updateLocation: (
    id: string,
    draft: WorldLocationDraft,
    revision: number
  ) => Promise<WorldLocationSnapshot>
  deleteLocation: (
    id: string,
    revision: number
  ) => Promise<WorldLocationSnapshot>
}

const defaultLocationCatalogPort: LocationCatalogPort = {
  readLocations: () => catalogCapabilities().locations.read(),
  readTables: () => encounterTableCapabilities().encounterTables.read(),
  readFactions: () => catalogCapabilities().factions.read(),
  readSession: () => catalogCapabilities().session.read(),
  createLocation: (draft, revision) =>
    catalogCapabilities().locations.create(draft, revision),
  updateLocation: (id, draft, revision) =>
    catalogCapabilities().locations.update(id, draft, revision),
  deleteLocation: (id, revision) =>
    catalogCapabilities().locations.delete(id, revision)
}

export function useLocationCatalogController(
  active: boolean,
  onError: (message: string) => void,
  setSession: (snapshot: LiveSessionSnapshot) => void,
  port: LocationCatalogPort = defaultLocationCatalogPort
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
  const [tables, setTables] = useState<EncounterTable[]>([])
  const [factions, setFactions] = useState<WorldFaction[]>([])

  useEffect(() => {
    if (!active) return
    let current = true
    void Promise.resolve().then(async () => {
      setLoading(true)
      try {
        const [locations, tableSnapshot, factionSnapshot] = await Promise.all([
          port.readLocations(),
          port.readTables(),
          port.readFactions()
        ])
        if (!current) return
        setSnapshot((known) =>
          locations.revision >= known.revision ? locations : known
        )
        setTables([...tableSnapshot.tables])
        setFactions([...factionSnapshot.factions])
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
          location.notes.toLocaleLowerCase().includes(needle)
      )
      .toSorted((left, right) => {
        const order = left.displayName.localeCompare(right.displayName)
        return direction === 'asc' ? order : -order
      })
  }, [direction, search, snapshot.locations])

  async function save(draft: WorldLocationDraft) {
    try {
      const previousIds = new Set(snapshot.locations.map((entry) => entry.id))
      const next = editing
        ? await port.updateLocation(editing.id, draft, snapshot.revision)
        : await port.createLocation(draft, snapshot.revision)
      const selectedId =
        editing?.id ??
        next.locations.find((entry) => !previousIds.has(entry.id))?.id
      setSnapshot(next)
      setSelected(
        next.locations.find((entry) => entry.id === selectedId) ?? null
      )
      setEditing(undefined)
      setSession(await port.readSession())
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function remove() {
    if (!selected) return
    try {
      setSnapshot(await port.deleteLocation(selected.id, snapshot.revision))
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
    tables,
    factions,
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
    remove,
    placed
  }
}

export type LocationCatalogController = ReturnType<
  typeof useLocationCatalogController
>
