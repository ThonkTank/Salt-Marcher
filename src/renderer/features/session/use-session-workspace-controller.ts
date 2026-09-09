import { useGroupLifecycle } from './use-group-lifecycle.js'
import type { Dispatch, SetStateAction } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { message } from '../../i18n/session-runtime.de.js'
import { useLootSceneController } from '../loot/use-loot-scene-controller.js'
import { useReferenceContext } from '../reference/reference-context.js'
import { useSessionDialogController } from './use-session-dialog-controller.js'
import { useSessionGroupController } from './use-session-group-controller.js'
import { useSessionReferenceFollow } from './use-session-reference-follow.js'
import { useSessionSceneController } from './use-session-scene-controller.js'
import type {
  SessionWorkspaceActions,
  SessionWorkspaceViewModel
} from './session-workspace-model.js'

export function useSessionWorkspaceController(input: {
  campaignId: string
  followCombat?: boolean
  snapshot: LiveSessionSnapshot
  setSnapshot: Dispatch<SetStateAction<LiveSessionSnapshot>>
  onError: (message: string) => void
}): Readonly<{
  model: SessionWorkspaceViewModel
  actions: SessionWorkspaceActions
  lifecycleNotice: ReturnType<typeof useGroupLifecycle>['notice']
  sceneNotice: ReturnType<typeof useSessionSceneController>['notice']
  sceneDialog: ReturnType<typeof useSessionSceneController>['dialog']
  sceneBusy: boolean
}> {
  const reference = useReferenceContext()
  const focused = input.snapshot.scene.scenes.find(
    (scene) => scene.id === input.snapshot.scene.focusedSceneId
  )!
  const lifecycle = useGroupLifecycle(
    input.campaignId,
    input.onError,
    focused.id
  )
  const { openCreature } = useSessionReferenceFollow({
    snapshot: input.snapshot,
    reference,
    follow: input.followCombat ?? true
  })
  const loot = useLootSceneController({
    sceneId: focused.id,
    locationId: focused.locationId,
    onError: input.onError
  })
  const dialog = useSessionDialogController(focused.id)
  const scene = useSessionSceneController({
    campaignId: input.campaignId,
    sceneId: focused.id,
    onError: input.onError,
    applied: input.setSnapshot
  })
  const groups = useSessionGroupController({
    scene: focused,
    groupTreasures: loot.scene.groupTreasures,
    onDelete: (group) =>
      lifecycle.execute({
        kind: 'delete',
        input: {
          sceneId: focused.id,
          groupId: group.id,
          expectedGroupRevision: group.revision
        }
      })
  })

  const actions: SessionWorkspaceActions = {
    toggleRow: groups.toggleRow,
    focusScene: scene.focus,
    setSceneLocation: scene.setLocation,
    openLedger: dialog.openLedger,
    inspectCreature: openCreature,
    editGroup: dialog.editGroup,
    manageGroups: dialog.manageGroups,
    reinforce: dialog.reinforce,
    groupLifecycleBusy: lifecycle.busy,
    restoreGroup: (group) =>
      lifecycle.execute({
        kind: 'archive',
        input: {
          sceneId: focused.id,
          groupId: group.id,
          archived: false,
          expectedGroupRevision: group.revision
        }
      }),
    requestGroupDelete: (id) => {
      if (!lifecycle.blocked()) groups.requestDelete(id)
    },
    cancelGroupDelete: groups.cancelDelete,
    confirmGroupDelete: (group) => {
      if (!lifecycle.blocked()) groups.confirmDelete(group)
    },
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
    lootChanged: () => void loot.refresh()
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
  return {
    model,
    actions,
    lifecycleNotice: lifecycle.notice,
    sceneNotice: scene.notice,
    sceneDialog: scene.dialog,
    sceneBusy: scene.busy
  }
}
