import { useCallback, useEffect } from 'react'
import { message } from '../../i18n/session-runtime.de.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import {
  groupDraftEntries,
  groupDraftStateFromGroup,
  newGroupDraftKey
} from './group-draft.js'
import { createGroupManagerInteractions } from './group-manager-interactions.js'
import {
  activeGroupSession,
  type GroupManagerAction
} from './group-manager-state.js'
import { projectGroupManagerView } from './group-manager-view-projection.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'
import { useGroupManagerCommands } from './use-group-manager-commands.js'
import { useGroupManagerDraftRuntime } from './use-group-manager-draft-runtime.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
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
  const coordinator = useAsyncCommandCoordinator()
  const initialFocused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const initialSelection =
    props.group?.id ??
    (initialFocused.groups.every((group) => group.archived)
      ? newGroupDraftKey
      : null)
  const { runtime, state, snapshot, pending, uncertain } =
    useGroupManagerDraftRuntime(
      {
        activeKey: initialSelection,
        initialGroup: props.group,
        locationId: initialFocused.locationId
      },
      props.snapshot
    )
  const dispatch = runtime.dispatch
  const focused = snapshot.scene.scenes.find(
    (scene) => scene.id === snapshot.scene.focusedSceneId
  )!
  const activeGroups = focused.groups.filter((group) => !group.archived)
  const editingBlocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    runtime.snapshot().pending ||
    runtime.snapshot().uncertain
  const userDispatch = useCallback(
    (action: GroupManagerAction) => {
      if (
        !maintenanceDraftCoordinator.isLocked() &&
        !runtime.snapshot().pending &&
        !runtime.snapshot().uncertain
      )
        runtime.dispatch(action)
    },
    [runtime]
  )
  const publish = (next: LiveSessionSnapshot) => {
    runtime.acceptSnapshot(next)
    if (!maintenanceDraftCoordinator.isLocked())
      props.saved(runtime.snapshot().snapshot)
  }
  const maintenanceBlocked = useMaintenanceDraft({
    label: 'Gruppenverwaltung',
    isDirty: runtime.isDirty,
    save: async () => {
      if (!(await runtime.saveAll(ports, coordinator, props.lootChanged)))
        return false
      props.saved(runtime.snapshot().snapshot)
      return true
    },
    discard: async () => {
      await runtime.discardAll(coordinator)
      props.saved(runtime.snapshot().snapshot)
      return true
    }
  })
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
  const assigned = snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  const canGenerate =
    state.activeKey !== null &&
    assigned.length > 0 &&
    assigned.every((member) => member.level !== null)

  useEffect(() => () => coordinator.cancelAll(), [coordinator, focused.id])

  useEffect(() => {
    dispatch({ kind: 'sync-external', groups: focused.groups })
  }, [dispatch, focused.groups])

  const queries = useGroupManagerQueries(
    {
      focused,
      snapshot,
      state,
      session,
      group,
      ports,
      dispatch,
      onError: props.onError
    },
    coordinator
  )
  const rawCommands = useGroupManagerCommands(
    {
      snapshot,
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
      saved: publish,
      failed: runtime.failed,
      lootChanged: props.lootChanged
    },
    coordinator
  )
  const commands = {
    ...rawCommands,
    pending,
    busy: pending || uncertain || maintenanceBlocked || rawCommands.busy,
    save: () =>
      editingBlocked() ? Promise.resolve(null) : runtime.run(rawCommands.save),
    commitLoot: () =>
      editingBlocked()
        ? Promise.resolve(null)
        : runtime.run(rawCommands.commitLoot),
    generateRoster: (...args: Parameters<typeof rawCommands.generateRoster>) =>
      editingBlocked()
        ? Promise.resolve()
        : runtime.run(() => rawCommands.generateRoster(...args)),
    generateLoot: (...args: Parameters<typeof rawCommands.generateLoot>) =>
      editingBlocked()
        ? Promise.resolve(false)
        : runtime.run(() => rawCommands.generateLoot(...args)),
    archive: () =>
      editingBlocked() ? Promise.resolve() : runtime.run(rawCommands.archive),
    joinCombat: () =>
      editingBlocked() ? Promise.resolve() : runtime.run(rawCommands.joinCombat)
  }
  const interactions = createGroupManagerInteractions({
    state,
    session,
    group,
    entries,
    commands,
    ports,
    dispatch: userDispatch,
    close: () => {
      if (editingBlocked()) return
      const confirmed = runtime.snapshot().snapshot
      if (confirmed.revision > props.snapshot.revision) props.saved(confirmed)
      else props.close()
    },
    inspect: (creature) => {
      if (!editingBlocked()) props.inspect(creature)
    }
  })

  return {
    ...projectGroupManagerView({
      snapshot,
      reinforcementMode: props.reinforcementMode,
      state,
      dispatch: userDispatch,
      focused,
      activeGroups,
      group,
      session,
      entries,
      assigned,
      selectedPersistedGroup,
      rewardGroupId,
      canGenerate,
      commands,
      queries,
      interactions
    }),
    maintenanceBlocked: maintenanceBlocked || uncertain,
    uncertain,
    canReconcile: runtime.canReconcile(),
    retryUnknown: async () => {
      if (runtime.snapshot().pending || maintenanceDraftCoordinator.isLocked())
        return
      try {
        if (!(await runtime.run(() => runtime.reconcileUnknown())))
          props.onError(message('group.receiptAbsent'))
      } catch {
        props.onError(message('group.receiptReadFailed'))
      }
    }
  }
}

export type GroupManagerController = ReturnType<
  typeof useGroupManagerController
>
