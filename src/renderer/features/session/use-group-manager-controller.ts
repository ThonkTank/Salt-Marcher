import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { EncounterTuningOverride } from '../../../shared/contracts/encounter-tuning.js'
import type { CommitGroupRewardResult } from '../../../shared/contracts/loot.js'
import type { SceneGroupDisposition } from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorIssues } from '../../../shared/errors/capability-error.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { SearchableSelectOption } from '../../shell/searchable-select.js'
import {
  catalogLootDraftCommand,
  groupLootCommitDraft,
  groupLootDraftDirty,
  groupLootDraftFromRun,
  type GroupLootDraftCommand
} from '../loot/group-loot-draft.js'
import type {
  TreasureContainerPatch,
  TreasureItemPatch
} from '../loot/treasure-draft-reducer.js'
import {
  applyCombatCommandResult,
  applySceneGroupCommandResult
} from './session-patches.js'
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
  type GroupCatalogMode,
  type GroupManagerRequestKind
} from './group-manager-state.js'
import {
  groupManagerIntentGuard,
  groupManagerIntentNeedsConfirmation,
  type GroupManagerIntent
} from './group-manager-intent.js'
import { generationSeed } from './generation-seed.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'
import { emptyQuery } from '../creatures/creature-state.js'

const tuning: EncounterTuningOverride = {
  difficulty: 'preset',
  amount: 'preset',
  balance: 'preset',
  diversity: 'preset'
}

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
  const entries = useMemo(
    () => groupDraftEntries(group.quantities, group.deadQuantities),
    [group.deadQuantities, group.quantities]
  )
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

  useEffect(() => {
    const token = crypto.randomUUID()
    dispatch({ kind: 'request-began', request: 'creature-options', token })
    void Promise.all([
      ports.creatures.filterOptions(),
      ports.creatures.search({
        ...emptyQuery,
        locationId: focused.locationId,
        offset: 0,
        limit: 1
      })
    ])
      .then(([options, first]) =>
        dispatch({
          kind: 'creature-options',
          token,
          options,
          total: first.total
        })
      )
      .catch((cause) => {
        dispatch({ kind: 'request-ended', request: 'creature-options', token })
        onError(capabilityErrorText(cause))
      })
  }, [focused.locationId, onError, ports.creatures])

  useEffect(() => {
    const token = crypto.randomUUID()
    dispatch({ kind: 'request-began', request: 'creature-search', token })
    const timer = window.setTimeout(() => {
      void ports.creatures
        .search(state.creatureCatalog.query)
        .then((page) => dispatch({ kind: 'creature-page', token, page }))
        .catch((cause) =>
          dispatch({
            kind: 'catalog-error',
            request: 'creature-search',
            token,
            error: capabilityErrorText(cause)
          })
        )
    }, 200)
    return () => window.clearTimeout(timer)
  }, [ports.creatures, state.creatureCatalog.query])

  useEffect(() => {
    const key = state.activeKey
    if (!key) return
    const token = crypto.randomUUID()
    dispatch({ kind: 'request-began', request: 'evaluation', token, key })
    const timer = window.setTimeout(() => {
      void ports.scene
        .evaluateGroupDraft(focused.id, entries, props.snapshot.scene.revision)
        .then((evaluation) =>
          dispatch({
            kind: 'evaluation-result',
            key,
            token,
            evaluation
          })
        )
        .catch((cause) =>
          dispatch({
            kind: 'request-message',
            request: 'evaluation',
            token,
            key,
            message: capabilityErrorText(cause)
          })
        )
    }, 120)
    return () => window.clearTimeout(timer)
  }, [
    entries,
    focused.id,
    ports.scene,
    props.snapshot.scene.revision,
    state.activeKey
  ])

  useEffect(() => {
    const key = state.activeKey
    if (!key || key === newGroupDraftKey) return
    const persisted = focused.groups.find((candidate) => candidate.id === key)
    if (!persisted) return
    const token = crypto.randomUUID()
    dispatch({ kind: 'request-began', request: 'facts', token, key })
    void Promise.all(
      persisted.entries.map((entry) =>
        ports.creatures.detail(entry.creatureId).catch(() => null)
      )
    ).then((creatures) =>
      dispatch({
        kind: 'facts-result',
        key,
        token,
        facts: Object.fromEntries(
          creatures.flatMap((creature) =>
            creature ? [[creature.id, creatureFact(creature)]] : []
          )
        )
      })
    )
  }, [focused.groups, ports.creatures, state.activeKey])

  useEffect(() => {
    const run = session?.loot.run
    if (!run || state.catalogMode !== 'loot') return
    const token = crypto.randomUUID()
    dispatch({ kind: 'request-began', request: 'loot-catalog', token })
    void ports.loot
      .catalog({
        ...state.lootCatalog.query,
        runId: run.id,
        catalogContentHash: run.catalogContentHash
      })
      .then((page) => dispatch({ kind: 'loot-catalog-page', token, page }))
      .catch((cause) =>
        dispatch({
          kind: 'catalog-error',
          request: 'loot-catalog',
          token,
          error: capabilityErrorText(cause)
        })
      )
  }, [
    ports.loot,
    session?.loot.run,
    state.catalogMode,
    state.lootCatalog.query
  ])

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
        void generateRoster(intent.mode)
        return
      case 'regenerate-loot':
        void generateLoot(
          entries,
          intent.mode === 'retry'
            ? (session?.loot.seed ?? generationSeed(ports.runtime.e2e))
            : generationSeed(ports.runtime.e2e)
        )
        return
      case 'save':
        void save()
        return
      case 'archive':
        void archive()
        return
      case 'join-combat':
        void joinCombat()
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

  async function generateRoster(mode: 'fill' | 'replace'): Promise<void> {
    const key = state.activeKey
    if (!key || !canGenerate) return
    const token = beginRequest('command', key)
    const seed = generationSeed(ports.runtime.e2e)
    try {
      const result = await ports.scene.generateGroupDraft(
        focused.id,
        entries,
        mode,
        state.creatureCatalog.query,
        tuning,
        seed,
        props.snapshot.scene.revision
      )
      const quantities = Object.fromEntries(
        result.entries.map((entry) => [entry.creatureId, entry.quantity])
      )
      const deadQuantities = mode === 'fill' ? group.deadQuantities : {}
      const previousCount = totalQuantity(group.quantities)
      const nextCount = totalQuantity(quantities)
      dispatch({
        kind: 'roster-generated',
        key,
        token,
        quantities,
        deadQuantities,
        facts: Object.fromEntries(
          result.entries.map((entry) => [
            entry.creatureId,
            {
              displayName: entry.displayName,
              cr: entry.cr,
              xp: entry.xp,
              available: entry.available
            }
          ])
        ),
        evaluation: result.evaluation,
        seed,
        message: result.message,
        generationSummary: formatMessage(
          mode === 'fill' ? 'group.generatedFilled' : 'group.generatedReplaced',
          {
            count:
              mode === 'fill'
                ? Math.max(0, nextCount - previousCount)
                : nextCount
          }
        )
      })
      endRequest('command', token)
      await generateLoot(
        groupDraftEntries(quantities, deadQuantities),
        generationSeed(ports.runtime.e2e),
        key
      )
    } catch (cause) {
      requestMessage('command', token, key, cause)
    }
  }

  async function generateLoot(
    rewardEntries = entries,
    seed = generationSeed(ports.runtime.e2e),
    key = state.activeKey
  ): Promise<boolean> {
    if (!key || rewardEntries.length === 0) return false
    const token = crypto.randomUUID()
    dispatch({
      kind: 'loot-request-began',
      key,
      token,
      phase: 'generating',
      seed
    })
    try {
      const rules = await ports.campaignRules.read()
      const result = await ports.loot.generateForGroupDraft({
        sceneId: focused.id,
        groupId: rewardGroupId,
        expectedSceneRevision: props.snapshot.scene.revision,
        expectedGroupRevision: selectedPersistedGroup?.revision ?? null,
        expectedPartyRevision: props.snapshot.party.revision,
        expectedCampaignRulesRevision: rules.revision,
        entries: [...rewardEntries],
        seed
      })
      const draft = groupLootDraftFromRun(result.run, () => crypto.randomUUID())
      dispatch({
        kind: 'loot-generated',
        key,
        token,
        run: result.run,
        draft,
        seed
      })
      return true
    } catch (cause) {
      dispatch({
        kind: 'loot-failed',
        key,
        token,
        error: capabilityErrorText(cause),
        issues: capabilityErrorIssues(cause)
      })
      return false
    }
  }

  async function commitLoot(): Promise<CommitGroupRewardResult | null> {
    const key = state.activeKey
    const run = session?.loot.run
    const treasure = run?.treasures[0]
    const history = session?.loot.history
    if (!key || !run || !history) return null
    if (!validateAvailableMonster()) return null
    const token = crypto.randomUUID()
    dispatch({
      kind: 'loot-request-began',
      key,
      token,
      phase: 'committing'
    })
    try {
      if (!treasure) {
        const result = await ports.scene.saveGroup(
          focused.id,
          key === newGroupDraftKey ? null : key,
          group.name.trim(),
          group.note.trim(),
          group.disposition,
          entries,
          props.snapshot.scene.revision,
          selectedPersistedGroup?.revision ?? null
        )
        dispatch({ kind: 'loot-committed', key, token })
        props.saved(applySceneGroupCommandResult(props.snapshot, result))
        return null
      }
      const result = await ports.loot.commitGroupReward({
        commandId: crypto.randomUUID(),
        runId: run.id,
        generatedTreasureId: treasure.id,
        treasureDraft: groupLootCommitDraft(history.draft),
        sceneId: focused.id,
        groupId: rewardGroupId,
        expectedSceneRevision: props.snapshot.scene.revision,
        expectedGroupRevision: selectedPersistedGroup?.revision ?? null,
        name: group.name.trim(),
        note: group.note.trim(),
        disposition: group.disposition,
        entries: [...entries]
      })
      dispatch({ kind: 'loot-committed', key, token })
      props.lootChanged()
      props.saved(
        applySceneGroupCommandResult(props.snapshot, result.groupResult)
      )
      return result
    } catch (cause) {
      dispatch({
        kind: 'loot-failed',
        key,
        token,
        error: capabilityErrorText(cause),
        issues: capabilityErrorIssues(cause)
      })
      return null
    }
  }

  async function save(): Promise<void> {
    if (!state.activeKey || !validateAvailableMonster()) return
    const token = beginRequest('command', state.activeKey)
    try {
      const result = await ports.scene.saveGroup(
        focused.id,
        state.activeKey === newGroupDraftKey ? null : state.activeKey,
        group.name.trim(),
        group.note.trim(),
        group.disposition,
        entries,
        props.snapshot.scene.revision,
        selectedPersistedGroup?.revision ?? null
      )
      endRequest('command', token)
      props.saved(applySceneGroupCommandResult(props.snapshot, result))
    } catch (cause) {
      requestMessage('command', token, state.activeKey, cause)
    }
  }

  async function archive(): Promise<void> {
    const key = state.activeKey
    if (!key || key === newGroupDraftKey || !selectedPersistedGroup) return
    const token = beginRequest('command', key)
    try {
      const result = await ports.scene.setGroupArchived(
        focused.id,
        key,
        true,
        selectedPersistedGroup.revision
      )
      endRequest('command', token)
      props.saved(applySceneGroupCommandResult(props.snapshot, result))
    } catch (cause) {
      requestMessage('command', token, key, cause)
    }
  }

  async function joinCombat(): Promise<void> {
    const key = state.activeKey
    if (
      !key ||
      key === newGroupDraftKey ||
      !selectedPersistedGroup ||
      !props.snapshot.combat
    )
      return
    const token = beginRequest('command', key)
    try {
      const result = await ports.combat.joinGroup({
        sceneId: focused.id,
        groupId: key,
        expectedGroupRevision: selectedPersistedGroup.revision,
        expectedCombatRevision: props.snapshot.combat.revision
      })
      endRequest('command', token)
      props.saved(applyCombatCommandResult(props.snapshot, result))
    } catch (cause) {
      requestMessage('command', token, key, cause)
    }
  }

  function validateAvailableMonster(): boolean {
    if (
      entries.length > 0 &&
      !entries.some(
        (entry) => group.facts[entry.creatureId]?.available === true
      )
    ) {
      mutateGroup({
        kind: 'message',
        update: message('group.validation.availableMonster')
      })
      return false
    }
    return true
  }

  function beginRequest(request: GroupManagerRequestKind, key: string): string {
    const token = crypto.randomUUID()
    dispatch({ kind: 'request-began', request, token, key })
    return token
  }

  function endRequest(request: GroupManagerRequestKind, token: string): void {
    dispatch({ kind: 'request-ended', request, token })
  }

  function requestMessage(
    request: GroupManagerRequestKind,
    token: string,
    key: string,
    cause: unknown
  ): void {
    dispatch({
      kind: 'request-message',
      request,
      token,
      key,
      message: capabilityErrorText(cause)
    })
  }

  const setGroupField = <Kind extends 'name' | 'note' | 'disposition'>(
    kind: Kind,
    update: Kind extends 'disposition' ? SceneGroupDisposition : string
  ) => mutateGroup({ kind, update } as GroupDraftMutation)

  const searchBiomeOptions = useCallback(
    async (query: string): Promise<readonly SearchableSelectOption[]> => {
      const token = crypto.randomUUID()
      dispatch({ kind: 'request-began', request: 'biome-search', token })
      try {
        const page = await ports.biomes.search({ query, offset: 0, limit: 60 })
        const options = page.biomes.map((biome) => ({
          id: biome.id,
          label: biome.displayName
        }))
        dispatch({
          kind: 'merge-biome-options',
          token,
          options,
          selectedIds: state.creatureCatalog.query.biomes
        })
        return options
      } catch (cause) {
        endRequest('biome-search', token)
        onError(capabilityErrorText(cause))
        return []
      }
    },
    [onError, ports.biomes, state.creatureCatalog.query.biomes]
  )

  const loot = session?.loot ?? null
  const lootHistory = loot?.history ?? null
  const currentLootDirty = Boolean(
    lootHistory && groupLootDraftDirty(lootHistory)
  )
  const busy =
    state.requests.command !== null ||
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
      generate: () => generateLoot(),
      retry: () => requestIntent({ kind: 'regenerate-loot', mode: 'retry' }),
      reroll: () => requestIntent({ kind: 'regenerate-loot', mode: 'reroll' }),
      commit: () => void commitLoot(),
      patchLabel: (label: string) => dispatchLoot({ kind: 'set-label', label }),
      patchItem: (id: string, patch: TreasureItemPatch) =>
        dispatchLoot({ kind: 'patch-item', id, patch }),
      patchContainer: (id: string, patch: TreasureContainerPatch) =>
        dispatchLoot({ kind: 'patch-container', id, patch }),
      removeItem: (id: string) => dispatchLoot({ kind: 'remove-item', id }),
      removeContainer: (id: string) =>
        dispatchLoot({ kind: 'remove-container', id }),
      addCatalogEntry: (
        entry: Parameters<typeof catalogLootDraftCommand>[1]
      ) => {
        if (!state.activeKey || !lootHistory) return
        dispatchLoot(
          catalogLootDraftCommand(lootHistory.draft, entry, crypto.randomUUID())
        )
      },
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

function totalQuantity(quantities: Readonly<Record<string, number>>): number {
  return Object.values(quantities).reduce(
    (total, quantity) => total + quantity,
    0
  )
}
