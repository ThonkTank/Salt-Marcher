import { useEffect, useReducer } from 'react'
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
  createGroupManagerState,
  groupManagerReducer
} from './group-manager-state.js'
import { projectGroupManagerView } from './group-manager-view-projection.js'
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
  const coordinator = useAsyncCommandCoordinator()
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

  useEffect(() => () => coordinator.cancelAll(), [coordinator, focused.id])

  useEffect(() => {
    dispatch({ kind: 'sync-external', groups: focused.groups })
  }, [focused.groups])

  const queries = useGroupManagerQueries(
    {
      focused,
      snapshot: props.snapshot,
      state,
      session,
      group,
      ports,
      dispatch,
      onError: props.onError
    },
    coordinator
  )
  const commands = useGroupManagerCommands(
    {
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
    },
    coordinator
  )
  const interactions = createGroupManagerInteractions({
    state,
    session,
    group,
    entries,
    commands,
    ports,
    dispatch,
    close: props.close,
    inspect: props.inspect
  })

  return projectGroupManagerView({
    snapshot: props.snapshot,
    reinforcementMode: props.reinforcementMode,
    state,
    dispatch,
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
  })
}

export type GroupManagerController = ReturnType<
  typeof useGroupManagerController
>
