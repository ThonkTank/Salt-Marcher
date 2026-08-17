import { useCallback, useEffect, useState } from 'react'
import type { CatalogCapabilities } from './catalog-capabilities.js'
import type { WorldFactionSnapshot } from '../../../shared/contracts/encounter-source.js'
import type { WorldLocation } from '../../../shared/contracts/world-location.js'
import type {
  WorldNpc,
  WorldNpcDetailProjection,
  WorldNpcDraft,
  WorldNpcListRow,
  WorldNpcPage
} from '../../../shared/contracts/world-npc.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import { emptyQuery } from '../creatures/creature-state.js'
import type { SearchableSelectOption } from '../../shell/searchable-select.js'

export type NpcLifecycleFilter = 'all' | WorldNpc['lifecycle']

const emptyPage: WorldNpcPage = {
  revision: 0,
  rows: [],
  total: 0,
  offset: 0,
  limit: 50
}

export function useNpcCatalogController(
  active: boolean,
  onError: (message: string) => void,
  api: CatalogCapabilities,
  creatures: CreatureCapabilityPort
) {
  const [page, setPage] = useState<WorldNpcPage>(emptyPage)
  const [factionSnapshot, setFactionSnapshot] = useState<WorldFactionSnapshot>({
    revision: 0,
    factions: []
  })
  const [locations, setLocations] = useState<readonly WorldLocation[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [lifecycle, setLifecycle] = useState<NpcLifecycleFilter>('all')
  const [factionId, setFactionId] = useState<string>('all')
  const [locationId, setLocationId] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedProjection, setSelectedProjection] =
    useState<WorldNpcDetailProjection | null>(null)
  const [editing, setEditing] = useState<WorldNpc | null | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [creatureOptions, setCreatureOptions] = useState<
    readonly SearchableSelectOption[]
  >([])

  const loadReferences = useCallback(async () => {
    const [factions, locationSnapshot] = await Promise.all([
      api.factions.read(),
      api.locations.read()
    ])
    setFactionSnapshot(factions)
    setLocations(locationSnapshot.locations)
  }, [api])

  const loadPage = useCallback(async () => {
    const result = await api.npcs.search({
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
    setPage(result)
  }, [api, factionId, lifecycle, locationId, search])

  const loadSelected = useCallback(
    async (id: string | null) => {
      if (id === null) {
        setSelectedProjection(null)
        return
      }
      const detail = await api.npcs.detail({ id })
      setSelectedProjection(detail)
    },
    [api]
  )

  useEffect(() => {
    if (!active) return
    let current = true
    const load = async () => {
      try {
        await Promise.all([loadPage(), loadReferences()])
      } catch (cause) {
        if (current) reportCapabilityError(onError)(cause)
      }
    }
    void load()
    const reload = () => {
      if (!current) return
      void Promise.all([
        loadPage(),
        loadReferences(),
        loadSelected(selectedId)
      ]).catch(reportCapabilityError(onError))
    }
    const unsubscribeNpcs = api.npcs.onChanged(reload)
    const unsubscribeLocations = api.locations.onChanged(reload)
    const unsubscribeFactions = api.factions.onChanged(reload)
    return () => {
      current = false
      unsubscribeNpcs()
      unsubscribeLocations()
      unsubscribeFactions()
    }
  }, [active, api, loadPage, loadReferences, loadSelected, onError, selectedId])

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 200)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const searchCreatures = useCallback(
    async (query: string): Promise<readonly SearchableSelectOption[]> => {
      try {
        const result = await creatures.search({
          ...emptyQuery,
          name: query,
          limit: 40
        })
        const options = result.rows.map((creature) => ({
          id: creature.id,
          label: creature.name,
          searchText: `${creature.id} ${creature.type} ${creature.subtype ?? ''}`,
          description: `CR ${creature.challengeRating}`
        }))
        setCreatureOptions((current) => mergeOptions(current, options))
        return options
      } catch (cause) {
        onError(capabilityErrorText(cause))
        return []
      }
    },
    [creatures, onError]
  )

  async function save(draft: WorldNpcDraft) {
    const commandId = crypto.randomUUID()
    try {
      const receipt = editing
        ? await api.npcs.update({
            commandId,
            id: editing.id,
            npc: draft,
            expectedRevision: page.revision,
            expectedFactionRevision: factionSnapshot.revision
          })
        : await api.npcs.create({
            commandId,
            npc: draft,
            expectedRevision: page.revision,
            expectedFactionRevision: factionSnapshot.revision
          })
      acceptMutation(receipt)
      await Promise.all([loadPage(), loadReferences()])
    } catch (cause) {
      if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
      const recovered = await api.npcs.commandReceipt({ commandId })
      if (!recovered || !('saved' in recovered)) throw cause
      acceptMutation(recovered)
      await Promise.all([loadPage(), loadReferences()])
    }
  }

  function acceptMutation(receipt: {
    revision: number
    factionRevision: number
    saved: WorldNpc
  }) {
    setPage((current) => ({ ...current, revision: receipt.revision }))
    setFactionSnapshot((current) => ({
      ...current,
      revision: receipt.factionRevision
    }))
    setSelectedId(receipt.saved.id)
    setSelectedProjection(null)
    setEditing(undefined)
    void loadSelected(receipt.saved.id).catch(reportCapabilityError(onError))
  }

  async function remove(id: string) {
    const commandId = crypto.randomUUID()
    try {
      let receipt
      try {
        receipt = await api.npcs.delete({
          commandId,
          id,
          expectedRevision: page.revision,
          expectedFactionRevision: factionSnapshot.revision
        })
      } catch (cause) {
        if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
        const recovered = await api.npcs.commandReceipt({ commandId })
        if (!recovered || !('deletedId' in recovered)) throw cause
        receipt = recovered
      }
      setPage((current) => ({ ...current, revision: receipt.revision }))
      setFactionSnapshot((current) => ({
        ...current,
        revision: receipt.factionRevision
      }))
      setSelectedId((current) => (current === id ? null : current))
      setSelectedProjection((current) =>
        current?.npc.id === id ? null : current
      )
      setDeleteId(null)
      await Promise.all([loadPage(), loadReferences()])
    } catch (cause) {
      reportCapabilityError(onError)(cause)
    }
  }

  return {
    snapshot: page,
    visible: page.rows,
    total: page.total,
    factions: factionSnapshot.factions,
    locations,
    searchInput,
    lifecycle,
    factionId,
    locationId,
    selected: selectedProjection?.npc ?? null,
    selectedProjection,
    editing,
    deleteId,
    creatureOptions,
    searchCreatures,
    setSearchInput,
    setLifecycle,
    setFactionId,
    setLocationId,
    setSelected: (npc: WorldNpcListRow | null) => {
      setSelectedId(npc?.id ?? null)
      setSelectedProjection(null)
      void loadSelected(npc?.id ?? null).catch(reportCapabilityError(onError))
    },
    setEditing,
    setDeleteId,
    save,
    remove
  }
}

function mergeOptions(
  current: readonly SearchableSelectOption[],
  incoming: readonly SearchableSelectOption[]
): readonly SearchableSelectOption[] {
  const merged = new Map(current.map((option) => [option.id, option]))
  for (const option of incoming) merged.set(option.id, option)
  return [...merged.values()]
}

export type NpcCatalogController = ReturnType<typeof useNpcCatalogController>
