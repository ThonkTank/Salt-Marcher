import type {
  WorldNpc,
  WorldNpcListRow
} from '../../../shared/contracts/world-npc.js'
import type { NpcCatalogEvent, NpcCatalogState } from './npc-catalog-state.js'
import { editableNpc } from './npc-catalog-state.js'
import type { useNpcCatalogMutations } from './use-npc-catalog-mutations.js'
import type { useNpcCatalogQueries } from './use-npc-catalog-queries.js'
import type { Dispatch } from 'react'

export function projectNpcCatalog(input: {
  state: NpcCatalogState
  dispatch: Dispatch<NpcCatalogEvent>
  queries: ReturnType<typeof useNpcCatalogQueries>
  mutations: ReturnType<typeof useNpcCatalogMutations>
}) {
  const { dispatch, mutations, queries, state } = input
  return {
    snapshot: queries.page,
    visible: queries.page.rows,
    total: queries.page.total,
    factions: queries.factionSnapshot.factions,
    locations: queries.locations,
    searchInput: queries.searchInput,
    lifecycle: queries.lifecycle,
    factionId: queries.factionId,
    locationId: queries.locationId,
    selectedId: queries.selectedId,
    selected: queries.selectedProjection?.npc ?? null,
    selectedProjection: queries.selectedProjection,
    status: state.status,
    editing: editableNpc(state),
    conflict: state.status === 'conflict' ? state.message : null,
    deleteId: state.status === 'deleting' ? state.npcId : null,
    creatureOptions: queries.creatureOptions,
    searchCreatures: queries.searchCreatures,
    setSearchInput: queries.setSearchInput,
    setLifecycle: queries.setLifecycle,
    setFactionId: queries.setFactionId,
    setLocationId: queries.setLocationId,
    setSelected: (npc: WorldNpcListRow | null) => queries.setSelected(npc),
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
    save: mutations.save,
    remove: mutations.remove
  }
}
