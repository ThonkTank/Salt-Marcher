import type { Dispatch } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import type { groupDraftEntries, GroupDraftState } from './group-draft.js'
import type {
  GroupDraftSession,
  GroupManagerAction,
  GroupManagerState
} from './group-manager-state.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'

export type GroupManagerCommandInput = {
  snapshot: LiveSessionSnapshot
  focused: LiveSessionSnapshot['scene']['scenes'][number]
  state: GroupManagerState
  session: GroupDraftSession | null
  group: GroupDraftState
  entries: ReturnType<typeof groupDraftEntries>
  selectedPersistedGroup: SceneGroup | undefined
  rewardGroupId: string
  canGenerate: boolean
  ports: GroupManagerPorts
  dispatch: Dispatch<GroupManagerAction>
  saved: (snapshot: LiveSessionSnapshot) => void
  lootChanged: () => void
}
