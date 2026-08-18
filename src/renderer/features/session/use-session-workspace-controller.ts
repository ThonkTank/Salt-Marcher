import type { Dispatch, SetStateAction } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { message } from '../../i18n/session-runtime.de.js'
import { useLootSceneController } from '../loot/use-loot-scene-controller.js'
import { useReferenceContext } from '../reference/reference-context.js'
import { sessionCapabilities } from './session-capabilities.js'
import { useSessionDialogController } from './use-session-dialog-controller.js'
import { useSessionGroupController } from './use-session-group-controller.js'
import { useSessionMutationController } from './use-session-mutation-controller.js'
import { useSessionReferenceFollow } from './use-session-reference-follow.js'
import { useSessionSceneController } from './use-session-scene-controller.js'
import type {
  SessionWorkspaceActions,
  SessionWorkspaceViewModel
} from './session-workspace-model.js'

export function useSessionWorkspaceController(input: {
  snapshot: LiveSessionSnapshot
  setSnapshot: Dispatch<SetStateAction<LiveSessionSnapshot>>
  onError: (message: string) => void
}): Readonly<{
  model: SessionWorkspaceViewModel
  actions: SessionWorkspaceActions
}> {
  const api = useCapabilityApi()
  const reference = useReferenceContext()
  const { mutateGroup, mutateSnapshot } = useSessionMutationController(input)
  const { openCreature } = useSessionReferenceFollow({
    snapshot: input.snapshot,
    reference
  })
  const focused = input.snapshot.scene.scenes.find(
    (scene) => scene.id === input.snapshot.scene.focusedSceneId
  )!
  const loot = useLootSceneController({
    sceneId: focused.id,
    locationId: focused.locationId,
    onError: input.onError
  })
  const dialog = useSessionDialogController()
  const scene = useSessionSceneController({ api, mutateSnapshot })
  const groups = useSessionGroupController({
    scene: focused,
    partyMembers: input.snapshot.party.members,
    groupTreasures: loot.scene.groupTreasures,
    onDelete: (group) =>
      void mutateGroup(
        (current) =>
          sessionCapabilities(api).scene.deleteGroup(
            focused.id,
            current.id,
            current.revision
          ),
        group
      )
  })

  const actions: SessionWorkspaceActions = {
    toggleRow: groups.toggleRow,
    focusScene: scene.focus,
    setSceneLocation: scene.setLocation,
    editParty: dialog.editParty,
    openLedger: dialog.openLedger,
    inspectCreature: openCreature,
    editGroup: dialog.editGroup,
    manageGroups: dialog.manageGroups,
    reinforce: dialog.reinforce,
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
    requestGroupDelete: groups.requestDelete,
    cancelGroupDelete: groups.cancelDelete,
    confirmGroupDelete: groups.confirmDelete,
    openLootInbox: () => void loot.openInbox(),
    loadMoreLoot: () => void loot.loadMore(),
    createLoot: dialog.createLoot,
    editLoot: dialog.editLoot,
    distribute: dialog.distribute,
    closeDialog: dialog.close,
    groupSaved: (snapshot) => {
      input.setSnapshot(snapshot)
      void loot.refresh()
      dialog.close()
    },
    lootChanged: () => void loot.refresh(),
    assignPartyMember: scene.assignPartyMember
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
      activeRows: groups.activeRows,
      archivedRows: groups.archivedRows,
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
    dialog: dialog.dialog
  }
  return { model, actions }
}
