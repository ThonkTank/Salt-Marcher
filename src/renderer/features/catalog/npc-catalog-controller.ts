import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
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
import {
  initialNpcCatalogState,
  reduceNpcCatalogState
} from './npc-catalog-state.js'

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
  const [state, dispatch] = useReducer(
    reduceNpcCatalogState,
    initialNpcCatalogState
  )
  const pageRequest = useRef(0)
  const referenceRequest = useRef(0)
  const detailRequest = useRef(0)
  const loadRequest = useRef(0)
  const mutationRequest = useRef(0)
  const [creatureOptions, setCreatureOptions] = useState<
    readonly SearchableSelectOption[]
  >([])

  const loadReferences = useCallback(async () => {
    const token = ++referenceRequest.current
    const [factions, locationSnapshot] = await Promise.all([
      api.factions.read(),
      api.locations.read()
    ])
    if (referenceRequest.current === token) {
      setFactionSnapshot(factions)
      setLocations(locationSnapshot.locations)
    }
  }, [api])

  const loadPage = useCallback(async () => {
    const token = ++pageRequest.current
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
    if (pageRequest.current === token) setPage(result)
  }, [api, factionId, lifecycle, locationId, search])

  const loadSelected = useCallback(
    async (id: string | null) => {
      const token = ++detailRequest.current
      if (id === null) {
        setSelectedProjection(null)
        return
      }
      const detail = await api.npcs.detail({ id })
      if (detailRequest.current === token) setSelectedProjection(detail)
    },
    [api]
  )

  useEffect(() => {
    if (!active) return
    let current = true
    const token = ++loadRequest.current
    dispatch({ type: 'load-started', token })
    const load = async () => {
      try {
        await Promise.all([loadPage(), loadReferences()])
        if (current && loadRequest.current === token)
          dispatch({ type: 'load-completed', token })
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
    const token = ++mutationRequest.current
    dispatch({ type: 'save-started', token })
    const rejectSave = (cause: unknown) => {
      dispatch({
        type: 'save-conflicted',
        token,
        message: capabilityErrorText(cause)
      })
    }
    try {
      const editing = editableNpc(state)
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
      if (mutationRequest.current !== token) return
      acceptMutation(receipt, token)
      await Promise.all([loadPage(), loadReferences()])
    } catch (cause) {
      if (capabilityErrorCode(cause) !== 'outcome_unknown') {
        rejectSave(cause)
        throw cause
      }
      try {
        const recovered = await api.npcs.commandReceipt({ commandId })
        if (!recovered || !('saved' in recovered)) throw cause
        if (mutationRequest.current !== token) return
        acceptMutation(recovered, token)
        await Promise.all([loadPage(), loadReferences()])
      } catch (recoveryCause) {
        rejectSave(recoveryCause)
        throw recoveryCause
      }
    }
  }

  function acceptMutation(
    receipt: {
      revision: number
      factionRevision: number
      saved: WorldNpc
    },
    token: number
  ) {
    setPage((current) => ({ ...current, revision: receipt.revision }))
    setFactionSnapshot((current) => ({
      ...current,
      revision: receipt.factionRevision
    }))
    setSelectedId(receipt.saved.id)
    setSelectedProjection(null)
    dispatch({ type: 'save-completed', token })
    void loadSelected(receipt.saved.id).catch(reportCapabilityError(onError))
  }

  async function remove(id: string) {
    const commandId = crypto.randomUUID()
    const token = ++mutationRequest.current
    dispatch({ type: 'delete-started', npcId: id, token })
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
      if (mutationRequest.current !== token) return
      setPage((current) => ({ ...current, revision: receipt.revision }))
      setFactionSnapshot((current) => ({
        ...current,
        revision: receipt.factionRevision
      }))
      setSelectedId((current) => (current === id ? null : current))
      setSelectedProjection((current) =>
        current?.npc.id === id ? null : current
      )
      dispatch({ type: 'delete-completed', token })
      await Promise.all([loadPage(), loadReferences()])
    } catch (cause) {
      dispatch({ type: 'delete-canceled' })
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
    selectedId,
    selected: selectedProjection?.npc ?? null,
    selectedProjection,
    status: state.status,
    editing: editableNpc(state),
    conflict: state.status === 'conflict' ? state.message : null,
    deleteId: state.status === 'deleting' ? state.npcId : null,
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
    setEditing: (npc: WorldNpc | null | undefined) =>
      dispatch(
        npc === undefined
          ? { type: 'edit-canceled' }
          : { type: 'edit-started', npc }
      ),
    setDeleteId: (id: string | null) =>
      dispatch(
        id === null
          ? { type: 'delete-canceled' }
          : { type: 'delete-requested', npcId: id }
      ),
    save,
    remove
  }
}

function editableNpc(
  state: ReturnType<typeof reduceNpcCatalogState>
): WorldNpc | null | undefined {
  return state.status === 'editing' ||
    state.status === 'saving' ||
    state.status === 'conflict'
    ? state.npc
    : undefined
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
