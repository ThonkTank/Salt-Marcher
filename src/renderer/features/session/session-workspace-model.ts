import type { PartyCharacter } from '../../../shared/contracts/party.js'
import type {
  SceneGroup,
  SceneSnapshot
} from '../../../shared/contracts/scene.js'
import type {
  LootInboxPage,
  LootSceneProjection,
  Treasure,
  TreasureAnchor
} from '../../../shared/contracts/loot.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'

export type SessionExpansionTarget = Readonly<{
  kind: 'group'
  groupId: string
}> | null

export type SessionRegisterRow =
  | Readonly<{
      kind: 'active-group'
      key: string
      sceneId: string
      group: SceneGroup
      count: number
      expanded: boolean
      treasures: readonly Treasure[]
    }>
  | Readonly<{
      kind: 'archived-group'
      key: string
      sceneId: string
      group: SceneGroup
      count: number
      expanded: boolean
      treasures: readonly Treasure[]
      deleteState: 'idle' | 'confirming'
    }>

export type SessionLootRow = Readonly<{
  kind: 'loot'
  placement: 'location' | 'unplaced' | 'unresolved'
  treasure: Treasure
  fallbackLabel?: string
}>

export type SessionDialogState =
  | Readonly<{ kind: 'none' }>
  | Readonly<{
      kind: 'group-editor'
      group: SceneGroup | null
      reinforcement: boolean
    }>
  | Readonly<{ kind: 'character-ledger'; character: PartyCharacter }>
  | Readonly<{ kind: 'reward-distribution'; treasure: Treasure }>
  | Readonly<{
      kind: 'treasure-editor'
      anchor: TreasureAnchor
      treasure: Treasure | null
    }>

export type SessionGroupsViewModel = Readonly<{
  scene: SceneSnapshot['scenes'][number]
  activeRows: readonly SessionRegisterRow[]
  archivedRows: readonly SessionRegisterRow[]
  locationLoot: readonly SessionLootRow[]
  inboxLoot: readonly SessionLootRow[]
  inbox: LootInboxPage
  inboxOpen: boolean
}>

export type SessionControlViewModel = Readonly<{
  focusedSceneId: string
  focusedSceneTitle: string
  focusedLocationId: string | null
  focusedLocationLabel: string
  scenes: readonly Readonly<{ id: string; title: string }>[]
  locationChoices: readonly Readonly<{ id: string; displayName: string }>[]
  locationUnavailable: boolean
}>

export type SessionWorkspaceViewModel = Readonly<{
  snapshot: LiveSessionSnapshot
  focused: SceneSnapshot['scenes'][number]
  loot: LootSceneProjection
  control: SessionControlViewModel
  groups: SessionGroupsViewModel
  dialog: SessionDialogState
}>

export type SessionWorkspaceActions = Readonly<{
  groupLifecycleBusy?: boolean
  toggleRow: (target: Exclude<SessionExpansionTarget, null>) => void
  focusScene: (sceneId: string) => void
  setSceneLocation: (locationId: string | null) => void
  openLedger: (character: PartyCharacter) => void
  inspectCreature: (creatureId: string, context: string) => void
  editGroup: (group: SceneGroup) => void
  manageGroups: () => void
  reinforce: () => void
  restoreGroup: (group: SceneGroup) => void
  requestGroupDelete: (groupId: string) => void
  cancelGroupDelete: () => void
  confirmGroupDelete: (group: SceneGroup) => void
  openLootInbox: () => void
  loadMoreLoot: () => void
  createLoot: (anchor: TreasureAnchor) => void
  editLoot: (treasure: Treasure) => void
  distribute: (treasure: Treasure) => void
  closeDialog: () => void
  groupSaved: (snapshot: LiveSessionSnapshot) => void
  lootChanged: () => void
}>

export function sameExpansionTarget(
  left: SessionExpansionTarget,
  right: Exclude<SessionExpansionTarget, null>
): boolean {
  return left?.kind === right.kind && left.groupId === right.groupId
}
