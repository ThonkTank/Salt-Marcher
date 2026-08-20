import { useCallback, useEffect, type Dispatch } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { SearchableSelectOption } from '../../shell/searchable-select.js'
import { emptyQuery } from '../creatures/creature-state.js'
import { useAsyncCommandCoordinator } from '../shared/use-async-command-coordinator.js'
import {
  creatureFact,
  groupDraftEntries,
  newGroupDraftKey,
  type GroupDraftState
} from './group-draft.js'
import type {
  GroupDraftSession,
  GroupManagerAction,
  GroupManagerState
} from './group-manager-state.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'

export function useGroupManagerQueries(input: {
  focused: LiveSessionSnapshot['scene']['scenes'][number]
  snapshot: LiveSessionSnapshot
  state: GroupManagerState
  session: GroupDraftSession | null
  group: GroupDraftState
  ports: GroupManagerPorts
  dispatch: Dispatch<GroupManagerAction>
  onError: (message: string) => void
}): Readonly<{
  searchBiomeOptions: (
    query: string
  ) => Promise<readonly SearchableSelectOption[]>
}> {
  const commands = useAsyncCommandCoordinator()
  const { dispatch, focused, onError, ports, session, snapshot, state } = input

  useEffect(() => {
    const abort = new AbortController()
    void commands
      .run({
        scope: 'group-manager.creature-options',
        mode: 'latest-only',
        signal: abort.signal,
        execute: () =>
          Promise.all([
            ports.creatures.filterOptions(),
            ports.creatures.search({
              ...emptyQuery,
              locationId: focused.locationId,
              offset: 0,
              limit: 1
            })
          ])
      })
      .then((outcome) => {
        if (outcome.status === 'success') {
          const [options, first] = outcome.value
          dispatch({ kind: 'creature-options', options, total: first.total })
        } else if (outcome.status === 'failure')
          onError(capabilityErrorText(outcome.cause))
      })
    return () => abort.abort()
  }, [commands, dispatch, focused.locationId, onError, ports.creatures])

  useEffect(() => {
    const abort = new AbortController()
    const timer = window.setTimeout(() => {
      void commands
        .run({
          scope: 'group-manager.creature-search',
          mode: 'latest-only',
          signal: abort.signal,
          execute: () => ports.creatures.search(state.creatureCatalog.query)
        })
        .then((outcome) => {
          if (outcome.status === 'success')
            dispatch({ kind: 'creature-page', page: outcome.value })
          else if (outcome.status === 'failure')
            dispatch({
              kind: 'catalog-error',
              request: 'creature-search',
              error: capabilityErrorText(outcome.cause)
            })
        })
    }, 200)
    return () => {
      window.clearTimeout(timer)
      abort.abort()
    }
  }, [commands, dispatch, ports.creatures, state.creatureCatalog.query])

  useEffect(() => {
    const key = state.activeKey
    if (!key) return
    const abort = new AbortController()
    const timer = window.setTimeout(() => {
      void commands
        .run({
          scope: 'group-manager.evaluation',
          mode: 'latest-only',
          signal: abort.signal,
          execute: () =>
            ports.scene.evaluateGroupDraft(
              focused.id,
              groupDraftEntries(
                input.group.quantities,
                input.group.deadQuantities
              ),
              snapshot.scene.revision
            )
        })
        .then((outcome) => {
          if (outcome.status === 'success')
            dispatch({
              kind: 'evaluation-result',
              key,
              evaluation: outcome.value
            })
          else if (outcome.status === 'failure')
            dispatch({
              kind: 'group-message',
              key,
              message: capabilityErrorText(outcome.cause)
            })
        })
    }, 120)
    return () => {
      window.clearTimeout(timer)
      abort.abort()
    }
  }, [
    commands,
    dispatch,
    focused.id,
    input.group.deadQuantities,
    input.group.quantities,
    ports.scene,
    snapshot.scene.revision,
    state.activeKey
  ])

  useEffect(() => {
    const key = state.activeKey
    if (!key || key === newGroupDraftKey) return
    const persisted = focused.groups.find((candidate) => candidate.id === key)
    if (!persisted) return
    const abort = new AbortController()
    void commands
      .run({
        scope: 'group-manager.facts',
        mode: 'latest-only',
        signal: abort.signal,
        execute: () =>
          Promise.all(
            persisted.entries.map((entry) =>
              ports.creatures.detail(entry.creatureId).catch(() => null)
            )
          )
      })
      .then((outcome) => {
        if (outcome.status !== 'success') return
        dispatch({
          kind: 'facts-result',
          key,
          facts: Object.fromEntries(
            outcome.value.flatMap((creature) =>
              creature ? [[creature.id, creatureFact(creature)]] : []
            )
          )
        })
      })
    return () => abort.abort()
  }, [commands, dispatch, focused.groups, ports.creatures, state.activeKey])

  useEffect(() => {
    const run = session?.loot.run
    if (!run || state.catalogMode !== 'loot') return
    const abort = new AbortController()
    void commands
      .run({
        scope: 'group-manager.loot-catalog',
        mode: 'latest-only',
        signal: abort.signal,
        execute: () =>
          ports.loot.catalog({
            ...state.lootCatalog.query,
            runId: run.id,
            catalogContentHash: run.catalogContentHash
          })
      })
      .then((outcome) => {
        if (outcome.status === 'success')
          dispatch({ kind: 'loot-catalog-page', page: outcome.value })
        else if (outcome.status === 'failure')
          dispatch({
            kind: 'catalog-error',
            request: 'loot-catalog',
            error: capabilityErrorText(outcome.cause)
          })
      })
    return () => abort.abort()
  }, [
    commands,
    dispatch,
    ports.loot,
    session?.loot.run,
    state.catalogMode,
    state.lootCatalog.query
  ])

  const searchBiomeOptions = useCallback(
    async (query: string): Promise<readonly SearchableSelectOption[]> => {
      const outcome = await commands.run({
        scope: 'group-manager.biome-search',
        mode: 'latest-only',
        execute: () => ports.biomes.search({ query, offset: 0, limit: 60 })
      })
      if (outcome.status === 'success') {
        const options = outcome.value.biomes.map((biome) => ({
          id: biome.id,
          label: biome.displayName
        }))
        dispatch({
          kind: 'merge-biome-options',
          options,
          selectedIds: state.creatureCatalog.query.biomes
        })
        return options
      }
      if (outcome.status === 'failure')
        onError(capabilityErrorText(outcome.cause))
      return []
    },
    [
      commands,
      dispatch,
      onError,
      ports.biomes,
      state.creatureCatalog.query.biomes
    ]
  )

  return { searchBiomeOptions }
}
