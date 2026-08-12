import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import { GroupDialog } from './group-dialog.js'

export function SessionDialogHost(props: {
  snapshot: LiveSessionSnapshot
  group: SceneGroup | null
  open: boolean
  reinforcementMode: boolean
  close: () => void
  saved: (snapshot: LiveSessionSnapshot) => void
  lootChanged: () => void
  inspect: (creatureId: string, creatureName: string) => void
  onError: (message: string) => void
}) {
  if (!props.open) return null
  return (
    <GroupDialog
      snapshot={props.snapshot}
      group={props.group}
      close={props.close}
      saved={props.saved}
      lootChanged={props.lootChanged}
      inspect={(creature) => props.inspect(creature.id, creature.name)}
      onError={props.onError}
      reinforcementMode={props.reinforcementMode}
    />
  )
}
