import { useEffect, useReducer } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { SceneGroupDisposition } from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import {
  groupLootDraftDirty,
  type GroupLootDraftCommand
} from '../loot/group-loot-draft.js'
import type {
  TreasureContainerPatch,
  TreasureItemPatch
} from '../loot/treasure-draft-reducer.js'
import {
  creatureFact,
  groupDraftEntries,
  groupDraftStateFromGroup,
  newGroupDraftKey,
  type GroupDraftMutation
} from './group-draft.js'
import {
  activeGroupSession,
  createGroupManagerState,
  groupManagerAnyDirty,
  groupManagerAnyLootDirty,
  groupManagerCurrentLootDirty,
  groupManagerReducer,
  groupDraftSessionDirty,
  type GroupCatalogMode
} from './group-manager-state.js'
import {
  groupManagerIntentGuard,
  groupManagerIntentNeedsConfirmation,
  type GroupManagerIntent
} from './group-manager-intent.js'
import { generationSeed } from './generation-seed.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'
import { useGroupManagerCommands } from './use-group-manager-commands.js'
import { useGroupManagerQueries } from './use-group-manager-queries.js'

export function useGroupManagerController(
  props: {
    snapshot: LiveSessionSnapshot
    group:
      LiveSessionSnapshot['scene']['scenes'][number]['groups'][number] | null
    close: () => void
    saved: (snapshot: LiveSessionSnapshot) => void
    lootChanged: () => void
    inspect: (creature: Creature) => void
    onError: (message: string) => void
    reinforcementMode: boolean
  },
  ports: GroupManagerPorts
) {
  const onError = props.onError
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const activeGroups = focused.groups.filter((group) => !group.archived)
  const initialSelection =
    props.group?.id ?? (activeGroups.length === 0 ? newGroupDraftKey : null)
  const [state, dispatch] = useReducer(groupManagerReducer, undefined, () =>
    createGroupManagerState({
      activeKey: initialSelection,
      initialGroup: props.group,
      prospectiveGroupId: crypto.randomUUID(),
      locationId: focused.locationId
    })
  )
  const session = activeGroupSession(state)
  const group = session?.group ?? groupDraftStateFromGroup(null)
  const entries = groupDraftEntries(group.quantities, group.deadQuantities)
  const selectedPersistedGroup = focused.groups.find(
    (candidate) => candidate.id === state.activeKey
  )
  const rewardGroupId =
    state.activeKey && state.activeKey !== newGroupDraftKey
      ? state.activeKey
      : state.prospectiveGroupId
  const assigned = props.snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  const canGenerate =
    state.activeKey !== null &&
    assigned.length > 0 &&
    assigned.every((member) => member.level !== null)
  useEffect(() => {
    dispatch({ kind: 'sync-external', groups: focused.groups })
  }, [focused.groups])

  const { searchBiomeOptions } = useGroupManagerQueries({
    focused,
    snapshot: props.snapshot,
    state,
    session,
    group,
    ports,
    dispatch,
    onError
  })
  const groupCommands = useGroupManagerCommands({
    snapshot: props.snapshot,
    focused,
    state,
    session,
    group,
    entries,
    selectedPersistedGroup,
    rewardGroupId,
    canGenerate,
    ports,
    dispatch,
    saved: props.saved,
    lootChanged: props.lootChanged
  })

  function requestIntent(intent: GroupManagerIntent) {
    const guard = groupManagerIntentGuard(intent)
    if (
      groupManagerIntentNeedsConfirmation(guard, {
        anyDraft: groupManagerAnyDirty(state),
        currentLoot: groupManagerCurrentLootDirty(state)
      })
    ) {
      dispatch({ kind: 'pending-intent', pending: { intent, guard } })
      return
    }
    performIntent(intent)
  }

  function performIntent(intent: GroupManagerIntent) {
    dispatch({ kind: 'pending-intent', pending: null })
    switch (intent.kind) {
      case 'close':
        props.close()
        return
      case 'add-creature':
        applyAddCreature(intent.creature)
        return
      case 'change-quantity':
        applyQuantityChange(
          intent.creatureId,
          intent.delta,
          intent.quantityKind
        )
        return
      case 'remove-creature':
        applyRemoveCreature(intent.creatureId)
        return
      case 'roster-history':
        mutateGroup({ kind: intent.direction })
        return
      case 'generate-roster':
        void groupCommands.generateRoster(intent.mode)
        return
      case 'regenerate-loot':
        void groupCommands.generateLoot(
          entries,
          intent.mode === 'retry'
            ? (session?.loot.seed ?? generationSeed(ports.runtime.e2e))
            : generationSeed(ports.runtime.e2e)
        )
        return
      case 'save':
        void groupCommands.save()
        return
      case 'archive':
        void groupCommands.archive()
        return
      case 'join-combat':
        void groupCommands.joinCombat()
    }
  }

  function mutateGroup(mutation: GroupDraftMutation): void {
    dispatch({ kind: 'mutate-group', mutation })
  }

  function applyAddCreature(creature: Creature): void {
    if (!session) return
    mutateGroup({
      kind: 'roster',
      update: {
        quantities: {
          ...group.quantities,
          [creature.id]: Math.min(999, (group.quantities[creature.id] ?? 0) + 1)
        },
        deadQuantities: group.deadQuantities
      }
    })
    mutateGroup({
      kind: 'facts',
      update: { ...group.facts, [creature.id]: creatureFact(creature) }
    })
  }

  function applyQuantityChange(
    creatureId: string,
    delta: number,
    quantityKind: 'alive' | 'dead'
  ): void {
    const current =
      quantityKind === 'alive' ? group.quantities : group.deadQuantities
    const quantity = Math.max(
      0,
      Math.min(999, (current[creatureId] ?? 0) + delta)
    )
    const next = { ...current }
    if (quantity === 0) delete next[creatureId]
    else next[creatureId] = quantity
    mutateGroup({
      kind: 'roster',
      update: {
        quantities: quantityKind === 'alive' ? next : group.quantities,
        deadQuantities: quantityKind === 'dead' ? next : group.deadQuantities
      }
    })
  }

  function applyRemoveCreature(creatureId: string): void {
    const quantities = { ...group.quantities }
    const deadQuantities = { ...group.deadQuantities }
    delete quantities[creatureId]
    delete deadQuantities[creatureId]
    mutateGroup({ kind: 'roster', update: { quantities, deadQuantities } })
  }

  const setGroupField = <Kind extends 'name' | 'note' | 'disposition'>(
    kind: Kind,
    update: Kind extends 'disposition' ? SceneGroupDisposition : string
  ) => mutateGroup({ kind, update } as GroupDraftMutation)

  const loot = session?.loot ?? null
  const lootHistory = loot?.history ?? null
  const currentLootDirty = Boolean(
    lootHistory && groupLootDraftDirty(lootHistory)
  )
  const busy =
    groupCommands.busy ||
    loot?.phase === 'generating' ||
    loot?.phase === 'committing'

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
      Boolean(props.snapshot.combat?.selectedGroupIds.includes(groupId)),
    canJoinCombat: Boolean(
      props.reinforcementMode &&
      props.snapshot.combat?.phase === 'combat' &&
      selectedPersistedGroup &&
      !props.snapshot.combat.selectedGroupIds.includes(
        selectedPersistedGroup.id
      )
    ),
    rewardGroupId,
    canGenerate,
    canGenerateLoot: canGenerate && entries.length > 0,
    busy,
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
      generate: () => groupCommands.generateLoot(),
      retry: () => requestIntent({ kind: 'regenerate-loot', mode: 'retry' }),
      reroll: () => requestIntent({ kind: 'regenerate-loot', mode: 'reroll' }),
      commit: () => void groupCommands.commitLoot(),
      patchLabel: (label: string) => dispatchLoot({ kind: 'set-label', label }),
      patchItem: (id: string, patch: TreasureItemPatch) =>
        dispatchLoot({ kind: 'patch-item', id, patch }),
      patchContainer: (id: string, patch: TreasureContainerPatch) =>
        dispatchLoot({ kind: 'patch-container', id, patch }),
      removeItem: (id: string) => dispatchLoot({ kind: 'remove-item', id }),
      removeContainer: (id: string) =>
        dispatchLoot({ kind: 'remove-container', id }),
      undo: () => dispatchLootHistory('undo'),
      redo: () => dispatchLootHistory('redo'),
      beginEdit: (editKey: string) => {
        if (state.activeKey)
          dispatch({
            kind: 'loot-edit-began',
            key: state.activeKey,
            editKey
          })
      },
      endEdit: () => {
        if (state.activeKey)
          dispatch({ kind: 'loot-edit-ended', key: state.activeKey })
      }
    },
    setName: (value: string) => setGroupField('name', value),
    setNote: (value: string) => setGroupField('note', value),
    setDisposition: (value: SceneGroupDisposition) =>
      setGroupField('disposition', value),
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
    searchBiomeOptions,
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
      requestIntent({ kind: 'add-creature', creature }),
    changeQuantity: (
      creatureId: string,
      delta: number,
      quantityKind: 'alive' | 'dead' = 'alive'
    ) =>
      requestIntent({
        kind: 'change-quantity',
        creatureId,
        delta,
        quantityKind
      }),
    removeCreature: (creatureId: string) =>
      requestIntent({ kind: 'remove-creature', creatureId }),
    moveRosterHistory: (direction: 'undo-roster' | 'redo-roster') =>
      requestIntent({ kind: 'roster-history', direction }),
    generateRoster: (mode: 'fill' | 'replace') =>
      requestIntent({ kind: 'generate-roster', mode }),
    inspectCreature: async (creature: Creature) => {
      try {
        props.inspect(await ports.creatures.detail(creature.id))
      } catch (cause) {
        mutateGroup({ kind: 'message', update: capabilityErrorText(cause) })
      }
    },
    close: () => requestIntent({ kind: 'close' }),
    save: () => requestIntent({ kind: 'save' }),
    archive: () => requestIntent({ kind: 'archive' }),
    joinCombat: () => requestIntent({ kind: 'join-combat' }),
    cancelPendingIntent: () =>
      dispatch({ kind: 'pending-intent', pending: null }),
    confirmPendingIntent: () => {
      const intent = state.pendingIntent?.intent
      if (intent) performIntent(intent)
    }
  }

  function dispatchLoot(command: GroupLootDraftCommand): void {
    if (state.activeKey)
      dispatch({ kind: 'loot-command', key: state.activeKey, command })
  }

  function dispatchLootHistory(direction: 'undo' | 'redo'): void {
    if (state.activeKey)
      dispatch({ kind: 'loot-history', key: state.activeKey, direction })
  }
}

export type GroupManagerController = ReturnType<
  typeof useGroupManagerController
>
