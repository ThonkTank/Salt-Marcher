import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import { GroupManagerView } from './group-manager-view.js'
import { useGroupManagerCapabilityPorts } from './use-group-manager-capability-ports.js'
import { useGroupManagerController } from './use-group-manager-controller.js'

export type GroupDialogProps = Readonly<{
  snapshot: LiveSessionSnapshot
  group: SceneGroup | null
  close: () => void
  saved: (snapshot: LiveSessionSnapshot) => void
  lootChanged: () => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
}>

export function GroupDialog(props: GroupDialogProps) {
  return (
    <GroupManagerView
      controller={useGroupManagerController(
        props,
        useGroupManagerCapabilityPorts()
      )}
    />
  )
}
