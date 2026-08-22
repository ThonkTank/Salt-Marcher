import type { Dispatch } from 'react'
import type {
  WorldNpc,
  WorldNpcDraft
} from '../../../shared/contracts/world-npc.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import type { CatalogCapabilities } from './catalog-capabilities.js'
import {
  editableNpc,
  type NpcCatalogEvent,
  type NpcCatalogState
} from './npc-catalog-state.js'
import type { useNpcCatalogQueries } from './use-npc-catalog-queries.js'

export function useNpcCatalogMutations(input: {
  api: CatalogCapabilities
  coordinator: AsyncCommandCoordinator
  state: NpcCatalogState
  dispatch: Dispatch<NpcCatalogEvent>
  queries: ReturnType<typeof useNpcCatalogQueries>
  onError: (message: string) => void
}) {
  const { api, coordinator, dispatch, onError, queries, state } = input

  async function save(draft: WorldNpcDraft): Promise<void> {
    const editing = editableNpc(state)
    const commandId = crypto.randomUUID()
    dispatch({ type: 'save-started' })
    const outcome = await coordinator.run({
      scope: 'npc-catalog.mutation',
      mode: 'latest-only',
      execute: async () => {
        try {
          return editing
            ? await api.npcs.update({
                commandId,
                id: editing.id,
                npc: draft,
                expectedRevision: queries.page.revision,
                expectedFactionRevision: queries.factionSnapshot.revision
              })
            : await api.npcs.create({
                commandId,
                npc: draft,
                expectedRevision: queries.page.revision,
                expectedFactionRevision: queries.factionSnapshot.revision
              })
        } catch (cause) {
          if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
          const recovered = await api.npcs.commandReceipt({ commandId })
          if (!recovered || !('saved' in recovered)) throw cause
          return recovered
        }
      }
    })
    if (outcome.status === 'stale') return
    if (outcome.status === 'failure') {
      dispatch({
        type: 'save-conflicted',
        message: capabilityErrorText(outcome.cause)
      })
      throw outcome.cause
    }
    acceptMutation(outcome.value)
    dispatch({ type: 'save-completed' })
    await Promise.all([queries.loadPage(), queries.loadReferences()])
  }

  function acceptMutation(receipt: {
    revision: number
    factionRevision: number
    saved: WorldNpc
  }): void {
    queries.setPage((current) => ({ ...current, revision: receipt.revision }))
    queries.setFactionSnapshot((current) => ({
      ...current,
      revision: receipt.factionRevision
    }))
    queries.setSelectedId(receipt.saved.id)
    queries.setSelectedProjection(null)
    void queries.loadSelected(receipt.saved.id)
  }

  async function remove(id: string): Promise<void> {
    const commandId = crypto.randomUUID()
    dispatch({ type: 'delete-started', npcId: id })
    const outcome = await coordinator.run({
      scope: 'npc-catalog.mutation',
      mode: 'latest-only',
      execute: async () => {
        try {
          return await api.npcs.delete({
            commandId,
            id,
            expectedRevision: queries.page.revision,
            expectedFactionRevision: queries.factionSnapshot.revision
          })
        } catch (cause) {
          if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
          const recovered = await api.npcs.commandReceipt({ commandId })
          if (!recovered || !('deletedId' in recovered)) throw cause
          return recovered
        }
      }
    })
    if (outcome.status === 'stale') return
    if (outcome.status === 'failure') {
      dispatch({ type: 'delete-canceled' })
      reportCapabilityError(onError)(outcome.cause)
      return
    }
    queries.setPage((current) => ({
      ...current,
      revision: outcome.value.revision
    }))
    queries.setFactionSnapshot((current) => ({
      ...current,
      revision: outcome.value.factionRevision
    }))
    queries.setSelectedId((current) => (current === id ? null : current))
    queries.setSelectedProjection((current) =>
      current?.npc.id === id ? null : current
    )
    dispatch({ type: 'delete-completed' })
    await Promise.all([queries.loadPage(), queries.loadReferences()])
  }

  return { save, remove }
}
