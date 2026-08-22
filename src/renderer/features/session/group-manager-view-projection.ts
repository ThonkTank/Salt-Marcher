import type { Dispatch } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  SceneGroup,
  SceneGroupDisposition
} from '../../../shared/contracts/scene.js'
import { groupLootDraftDirty } from '../loot/group-loot-draft.js'
import type {
  TreasureContainerPatch,
  TreasureItemPatch
} from '../loot/treasure-draft-reducer.js'
import {
  groupDraftEntries,
  groupDraftStateFromGroup,
  type GroupDraftState
} from './group-draft.js'
import type { GroupManagerInteractions } from './group-manager-interactions.js'
import {
  groupDraftSessionDirty,
  groupManagerAnyDirty,
  groupManagerAnyLootDirty,
  type GroupCatalogMode,
  type GroupDraftSession,
  type GroupManagerAction,
  type GroupManagerState
} from './group-manager-state.js'
import type { useGroupManagerCommands } from './use-group-manager-commands.js'
import type { useGroupManagerQueries } from './use-group-manager-queries.js'

export function projectGroupManagerView(input: {
  snapshot: LiveSessionSnapshot
  reinforcementMode: boolean
  state: GroupManagerState
  dispatch: Dispatch<GroupManagerAction>
  focused: LiveSessionSnapshot['scene']['scenes'][number]
  activeGroups: readonly SceneGroup[]
  group: GroupDraftState
  session: GroupDraftSession | null
  entries: ReturnType<typeof groupDraftEntries>
  assigned: LiveSessionSnapshot['party']['members']
  selectedPersistedGroup: SceneGroup | undefined
  rewardGroupId: string
  canGenerate: boolean
  commands: ReturnType<typeof useGroupManagerCommands>
  queries: ReturnType<typeof useGroupManagerQueries>
  interactions: GroupManagerInteractions
}) {
  const {
    activeGroups,
    assigned,
    canGenerate,
    commands,
    dispatch,
    entries,
    focused,
    group,
    interactions,
    queries,
    rewardGroupId,
    selectedPersistedGroup,
    session,
    snapshot,
    state
  } = input
  const loot = session?.loot ?? null
  const lootHistory = loot?.history ?? null
  const currentLootDirty = Boolean(
    lootHistory && groupLootDraftDirty(lootHistory)
  )

  return {
    state,
    dispatch,
    focused,
    activeGroups,
    selection: state.activeKey,
    active: state.activeKey !== null,
    group,
    session,
    entries,
    assigned,
    selectedPersistedGroup,
    groupInCombat: (groupId: string) =>
      Boolean(snapshot.combat?.selectedGroupIds.includes(groupId)),
    canJoinCombat: Boolean(
      input.reinforcementMode &&
      snapshot.combat?.phase === 'combat' &&
      selectedPersistedGroup &&
      !snapshot.combat.selectedGroupIds.includes(selectedPersistedGroup.id)
    ),
    rewardGroupId,
    canGenerate,
    canGenerateLoot: canGenerate && entries.length > 0,
    busy:
      commands.busy ||
      loot?.phase === 'generating' ||
      loot?.phase === 'committing',
    dirty: session ? groupDraftSessionDirty(session) : false,
    anyDirty: groupManagerAnyDirty(state),
    anyLootDirty: groupManagerAnyLootDirty(state),
    currentLootDirty,
    effectiveCatalogMode: (state.catalogMode === 'loot' && loot?.run
      ? 'loot'
      : 'creatures') as GroupCatalogMode,
    loot: {
      run: loot?.run ?? null,
      draft: lootHistory?.draft ?? null,
      phase: loot?.phase ?? 'idle',
      error: loot?.error ?? '',
      issues: loot?.issues ?? [],
      dirty: currentLootDirty,
      canUndo: (lootHistory?.past.length ?? 0) > 0,
      canRedo: (lootHistory?.future.length ?? 0) > 0,
      generate: () => commands.generateLoot(),
      retry: () =>
        interactions.requestIntent({ kind: 'regenerate-loot', mode: 'retry' }),
      reroll: () =>
        interactions.requestIntent({ kind: 'regenerate-loot', mode: 'reroll' }),
      commit: () => void commands.commitLoot(),
      patchLabel: (label: string) =>
        interactions.dispatchLoot({ kind: 'set-label', label }),
      patchItem: (id: string, patch: TreasureItemPatch) =>
        interactions.dispatchLoot({ kind: 'patch-item', id, patch }),
      patchContainer: (id: string, patch: TreasureContainerPatch) =>
        interactions.dispatchLoot({ kind: 'patch-container', id, patch }),
      removeItem: (id: string) =>
        interactions.dispatchLoot({ kind: 'remove-item', id }),
      removeContainer: (id: string) =>
        interactions.dispatchLoot({ kind: 'remove-container', id }),
      undo: () => interactions.dispatchLootHistory('undo'),
      redo: () => interactions.dispatchLootHistory('redo'),
      beginEdit: (editKey: string) => {
        if (state.activeKey)
          dispatch({ kind: 'loot-edit-began', key: state.activeKey, editKey })
      },
      endEdit: () => {
        if (state.activeKey)
          dispatch({ kind: 'loot-edit-ended', key: state.activeKey })
      }
    },
    setName: (value: string) => interactions.setGroupField('name', value),
    setNote: (value: string) => interactions.setGroupField('note', value),
    setDisposition: (value: SceneGroupDisposition) =>
      interactions.setGroupField('disposition', value),
    setCreatureQuery: (query: typeof state.creatureCatalog.query) =>
      dispatch({ kind: 'creature-query', query }),
    setLootQuery: (
      patch: Partial<typeof state.lootCatalog.query>,
      preserveOffset?: boolean
    ) =>
      dispatch({
        kind: 'loot-query',
        patch,
        ...(preserveOffset === undefined ? {} : { preserveOffset })
      }),
    searchBiomeOptions: queries.searchBiomeOptions,
    setCatalogMode: (catalogMode: GroupCatalogMode) =>
      dispatch({
        kind: 'view',
        catalogMode,
        workspaceMode: catalogMode === 'loot' ? 'loot' : 'group'
      }),
    setWorkspaceMode: (workspaceMode: 'group' | 'loot') =>
      dispatch({
        kind: 'view',
        workspaceMode,
        catalogMode: workspaceMode === 'loot' ? 'loot' : 'creatures'
      }),
    setDraftPaneWidth: (width: number) =>
      dispatch({ kind: 'draft-width', width }),
    activate: (key: string | null) => {
      const persisted = focused.groups.find((candidate) => candidate.id === key)
      dispatch({
        kind: 'activate',
        key,
        fallback: groupDraftStateFromGroup(persisted),
        sourceRevision: persisted?.revision ?? null
      })
    },
    addCreature: (creature: Creature) =>
      interactions.requestIntent({ kind: 'add-creature', creature }),
    changeQuantity: (
      creatureId: string,
      delta: number,
      quantityKind: 'alive' | 'dead' = 'alive'
    ) =>
      interactions.requestIntent({
        kind: 'change-quantity',
        creatureId,
        delta,
        quantityKind
      }),
    removeCreature: (creatureId: string) =>
      interactions.requestIntent({ kind: 'remove-creature', creatureId }),
    moveRosterHistory: (direction: 'undo-roster' | 'redo-roster') =>
      interactions.requestIntent({ kind: 'roster-history', direction }),
    generateRoster: (mode: 'fill' | 'replace') =>
      interactions.requestIntent({ kind: 'generate-roster', mode }),
    inspectCreature: interactions.inspectCreature,
    close: () => interactions.requestIntent({ kind: 'close' }),
    save: () => interactions.requestIntent({ kind: 'save' }),
    archive: () => interactions.requestIntent({ kind: 'archive' }),
    joinCombat: () => interactions.requestIntent({ kind: 'join-combat' }),
    cancelPendingIntent: () =>
      dispatch({ kind: 'pending-intent', pending: null }),
    confirmPendingIntent: () => {
      const intent = state.pendingIntent?.intent
      if (intent) interactions.performIntent(intent)
    }
  }
}
