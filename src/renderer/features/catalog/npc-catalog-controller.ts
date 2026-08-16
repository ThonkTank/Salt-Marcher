import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CatalogCapabilities } from './catalog-capabilities.js'
import type { WorldFactionSnapshot } from '../../../shared/contracts/encounter-source.js'
import type { WorldLocation } from '../../../shared/contracts/world-location.js'
import type {
  WorldNpc,
  WorldNpcDraft,
  WorldNpcSnapshot
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

export function useNpcCatalogController(
  active: boolean,
  onError: (message: string) => void,
  api: CatalogCapabilities,
  creatures: CreatureCapabilityPort
) {
  const [snapshot, setSnapshot] = useState<WorldNpcSnapshot>({
    revision: 0,
    npcs: []
  })
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
  const [editing, setEditing] = useState<WorldNpc | null | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [creatureOptions, setCreatureOptions] = useState<
    readonly SearchableSelectOption[]
  >([])

  useEffect(() => {
    if (!active) return
    let current = true
    const load = () =>
      Promise.all([api.npcs.read(), api.factions.read(), api.locations.read()])
        .then(([npcs, factions, locationSnapshot]) => {
          if (!current) return
          setSnapshot(npcs)
          setFactionSnapshot(factions)
          setLocations(locationSnapshot.locations)
        })
        .catch(reportCapabilityError(onError))
    void load()
    const unsubscribe = api.npcs.onChanged(() => {
      void load()
    })
    return () => {
      current = false
      unsubscribe()
    }
  }, [active, api, onError])

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 200)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return snapshot.npcs.filter(
      (npc) =>
        (lifecycle === 'all' || npc.lifecycle === lifecycle) &&
        (factionId === 'all' ||
          (factionId === 'none'
            ? npc.factionId === null
            : npc.factionId === factionId)) &&
        (locationId === 'all' ||
          (locationId === 'none'
            ? npc.locationId === null
            : npc.locationId === locationId)) &&
        [
          npc.displayName,
          npc.creatureId,
          npc.appearance,
          npc.behavior,
          npc.history,
          npc.notes
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle)
    )
  }, [factionId, lifecycle, locationId, search, snapshot.npcs])

  const selected = snapshot.npcs.find((npc) => npc.id === selectedId) ?? null

  const searchCreatures = useCallback(
    async (query: string): Promise<readonly SearchableSelectOption[]> => {
      try {
        const page = await creatures.search({
          ...emptyQuery,
          name: query,
          limit: 40
        })
        const options = page.rows.map((creature) => ({
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
            expectedRevision: snapshot.revision,
            expectedFactionRevision: factionSnapshot.revision
          })
        : await api.npcs.create({
            commandId,
            npc: draft,
            expectedRevision: snapshot.revision,
            expectedFactionRevision: factionSnapshot.revision
          })
      acceptMutation(receipt)
    } catch (cause) {
      if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
      const recovered = await api.npcs.commandReceipt({ commandId })
      if (!recovered || !('saved' in recovered)) throw cause
      acceptMutation(recovered)
    }
  }

  function acceptMutation(receipt: {
    snapshot: WorldNpcSnapshot
    factionSnapshot: WorldFactionSnapshot
    saved: WorldNpc
  }) {
    setSnapshot(receipt.snapshot)
    setFactionSnapshot(receipt.factionSnapshot)
    setSelectedId(receipt.saved.id)
    setEditing(undefined)
  }

  async function remove(id: string) {
    const commandId = crypto.randomUUID()
    try {
      let receipt
      try {
        receipt = await api.npcs.delete({
          commandId,
          id,
          expectedRevision: snapshot.revision,
          expectedFactionRevision: factionSnapshot.revision
        })
      } catch (cause) {
        if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
        const recovered = await api.npcs.commandReceipt({ commandId })
        if (!recovered || !('deletedId' in recovered)) throw cause
        receipt = recovered
      }
      setSnapshot(receipt.snapshot)
      setFactionSnapshot(receipt.factionSnapshot)
      setSelectedId((current) => (current === id ? null : current))
      setDeleteId(null)
    } catch (cause) {
      reportCapabilityError(onError)(cause)
    }
  }

  return {
    snapshot,
    visible,
    factions: factionSnapshot.factions,
    locations,
    searchInput,
    lifecycle,
    factionId,
    locationId,
    selected,
    editing,
    deleteId,
    creatureOptions,
    searchCreatures,
    setSearchInput,
    setLifecycle,
    setFactionId,
    setLocationId,
    setSelected: (npc: WorldNpc | null) => setSelectedId(npc?.id ?? null),
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
