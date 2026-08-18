import { useEffect, useRef, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SceneGroupCommandResult } from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { useLootSceneController } from '../loot/use-loot-scene-controller.js'
import { useReferenceContext } from '../reference/reference-context.js'
import { sessionCapabilities } from './session-capabilities.js'
import { applySceneGroupCommandResult } from './session-patches.js'
import {
  sameExpansionTarget,
  type SessionDialogState,
  type SessionExpansionTarget,
  type SessionRegisterRow,
  type SessionWorkspaceActions,
  type SessionWorkspaceViewModel
} from './session-workspace-model.js'

export function useSessionWorkspaceController(input: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
}): Readonly<{
  model: SessionWorkspaceViewModel
  actions: SessionWorkspaceActions
}> {
  const api = useCapabilityApi()
  const reference = useReferenceContext()
  const latestSnapshot = useRef(input.snapshot)
  useEffect(() => {
    latestSnapshot.current = input.snapshot
  }, [input.snapshot])
  const focused = input.snapshot.scene.scenes.find(
    (scene) => scene.id === input.snapshot.scene.focusedSceneId
  )!
  const loot = useLootSceneController({
    sceneId: focused.id,
    locationId: focused.locationId,
    onError: input.onError
  })
  const [dialog, setDialog] = useState<SessionDialogState>({ kind: 'none' })
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [expandedByScene, setExpandedByScene] = useState<
    Record<string, SessionExpansionTarget>
  >({})
  const followedCombatCard = useRef<string | null>(null)

  const activeGroups = focused.groups.filter((group) => !group.archived)
  const storedExpansion = expandedByScene[focused.id]
  const expansion: SessionExpansionTarget = validExpansion(
    storedExpansion,
    focused.groups
  )
    ? storedExpansion
    : activeGroups[0]
      ? { kind: 'group', groupId: activeGroups[0].id }
      : { kind: 'party' }
  const groupLoot = new Map(
    loot.scene.groupTreasures.map((entry) => [entry.groupId, entry.treasures])
  )
  const assignedMembers = input.snapshot.party.members.filter(
    (member) => member.active && focused.partyMemberIds.includes(member.id)
  )
  const partyRow: SessionRegisterRow = {
    kind: 'party',
    key: 'party',
    name: message('ui.party'),
    count: assignedMembers.length,
    expanded: sameExpansionTarget(expansion, { kind: 'party' }),
    members: assignedMembers
  }
  const activeRows: SessionRegisterRow[] = [
    partyRow,
    ...activeGroups.map((group) => ({
      kind: 'active-group' as const,
      key: group.id,
      sceneId: focused.id,
      group,
      count: group.entries.reduce((sum, entry) => sum + entry.quantity, 0),
      expanded: sameExpansionTarget(expansion, {
        kind: 'group',
        groupId: group.id
      }),
      treasures: groupLoot.get(group.id) ?? []
    }))
  ]
  const archivedRows: SessionRegisterRow[] = focused.groups
    .filter((group) => group.archived)
    .map((group) => ({
      kind: 'archived-group' as const,
      key: group.id,
      sceneId: focused.id,
      group,
      count: group.entries.reduce((sum, entry) => sum + entry.quantity, 0),
      expanded: sameExpansionTarget(expansion, {
        kind: 'group',
        groupId: group.id
      }),
      treasures: groupLoot.get(group.id) ?? [],
      deleteState: deleteGroupId === group.id ? 'confirming' : 'idle'
    }))

  const openCreature = (creatureId: string, context: string) =>
    reference.openReference(
      { scope: 'creature', creatureId },
      formatMessage('reference.contextCreature', { context })
    )
  const activeCombatCard = input.snapshot.combat?.cards.find(
    (card) => card.active && !card.playerCharacter && card.creatureId
  )
  useEffect(() => {
    if (!activeCombatCard?.creatureId) {
      followedCombatCard.current = null
      return
    }
    if (followedCombatCard.current === activeCombatCard.id) return
    followedCombatCard.current = activeCombatCard.id
    const group = focused.groups.find((candidate) =>
      candidate.entries.some(
        (entry) => entry.creatureId === activeCombatCard.creatureId
      )
    )
    openCreature(
      activeCombatCard.creatureId,
      group?.name ?? message('ui.encounter')
    )
    // Active-card identity is the synchronization token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCombatCard?.id, activeCombatCard?.creatureId])

  const mutateGroup = async (
    operation: (group: SceneGroup) => Promise<SceneGroupCommandResult>,
    group: SceneGroup
  ) => {
    try {
      const current = latestSnapshot.current
      input.setSnapshot(
        applySceneGroupCommandResult(current, await operation(group))
      )
    } catch (cause) {
      input.onError(capabilityErrorText(cause))
    }
  }
  const mutateSnapshot = async (
    operation: (snapshot: LiveSessionSnapshot) => Promise<LiveSessionSnapshot>
  ) => {
    try {
      input.setSnapshot(await operation(latestSnapshot.current))
    } catch (cause) {
      input.onError(capabilityErrorText(cause))
    }
  }
  const actions: SessionWorkspaceActions = {
    toggleRow: (target) =>
      setExpandedByScene((current) => ({
        ...current,
        [focused.id]: sameExpansionTarget(expansion, target) ? null : target
      })),
    focusScene: (sceneId) =>
      void mutateSnapshot((current) =>
        sessionCapabilities(api).scene.focus(sceneId, current.scene.revision)
      ),
    setSceneLocation: (locationId) =>
      void mutateSnapshot((current) =>
        sessionCapabilities(api).scene.setLocation(
          current.scene.focusedSceneId,
          locationId,
          current.scene.revision
        )
      ),
    editParty: () => setDialog({ kind: 'party-editor' }),
    openLedger: (character) =>
      setDialog({ kind: 'character-ledger', character }),
    inspectCreature: openCreature,
    editGroup: (group) => setDialog({ kind: 'group-editor', group }),
    createGroup: () => setDialog({ kind: 'group-editor', group: null }),
    restoreGroup: (group) =>
      void mutateGroup(
        (current) =>
          sessionCapabilities(api).scene.setGroupArchived(
            focused.id,
            current.id,
            false,
            current.revision
          ),
        group
      ),
    requestGroupDelete: setDeleteGroupId,
    cancelGroupDelete: () => setDeleteGroupId(null),
    confirmGroupDelete: (group) => {
      setDeleteGroupId(null)
      void mutateGroup(
        (current) =>
          sessionCapabilities(api).scene.deleteGroup(
            focused.id,
            current.id,
            current.revision
          ),
        group
      )
    },
    openLootInbox: () => void loot.openInbox(),
    loadMoreLoot: () => void loot.loadMore(),
    createLoot: (anchor) =>
      setDialog({ kind: 'treasure-editor', anchor, treasure: null }),
    editLoot: (treasure) =>
      setDialog({
        kind: 'treasure-editor',
        anchor: treasure.anchor,
        treasure
      }),
    distribute: (treasure) =>
      setDialog({ kind: 'reward-distribution', treasure }),
    closeDialog: () => setDialog({ kind: 'none' }),
    groupSaved: (snapshot) => {
      input.setSnapshot(snapshot)
      void loot.refresh()
      setDialog({ kind: 'none' })
    },
    lootChanged: () => void loot.refresh(),
    assignPartyMember: (memberId, assigned) => {
      const current = latestSnapshot.current
      void sessionCapabilities(api)
        .scene.assignPartyMember(
          focused.id,
          memberId,
          assigned,
          current.scene.revision
        )
        .then(input.setSnapshot)
        .catch((cause: unknown) => input.onError(capabilityErrorText(cause)))
    }
  }
  const model: SessionWorkspaceViewModel = {
    snapshot: input.snapshot,
    focused,
    loot: loot.scene,
    control: {
      focusedSceneId: focused.id,
      focusedSceneTitle: focused.title,
      focusedLocationId: focused.locationId,
      focusedLocationLabel: focused.locationId
        ? (input.snapshot.scene.locationChoices.find(
            (candidate) => candidate.id === focused.locationId
          )?.displayName ??
          focused.locationName ??
          message('ui.nicht.verfuegbarer.ort'))
        : message('ui.kein.ort'),
      scenes: input.snapshot.scene.scenes.map((scene) => ({
        id: scene.id,
        title: scene.title
      })),
      locationChoices: input.snapshot.scene.locationChoices,
      locationUnavailable:
        focused.locationId !== null &&
        !input.snapshot.scene.locationChoices.some(
          (candidate) => candidate.id === focused.locationId
        )
    },
    groups: {
      scene: focused,
      activeRows,
      archivedRows,
      locationLoot: loot.scene.locationTreasures.map((treasure) => ({
        kind: 'loot',
        placement: 'location',
        treasure
      })),
      inboxLoot: loot.inbox.entries.map((entry) => ({
        kind: 'loot',
        placement: entry.reason === 'unplaced' ? 'unplaced' : 'unresolved',
        treasure: entry.treasure,
        ...(entry.lastKnownLabel ? { fallbackLabel: entry.lastKnownLabel } : {})
      })),
      inbox: loot.inbox,
      inboxOpen: loot.inboxOpen
    },
    dialog
  }
  return { model, actions }
}

function validExpansion(
  value: SessionExpansionTarget | undefined,
  groups: readonly SceneGroup[]
): value is SessionExpansionTarget {
  return (
    value === null ||
    value?.kind === 'party' ||
    (value?.kind === 'group' &&
      groups.some((group) => group.id === value.groupId))
  )
}
