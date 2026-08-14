import { lazy, Suspense } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'

const LazyGroupDialog = lazy(async () => {
  const module = await import('./group-dialog.js')
  return { default: module.GroupDialog }
})

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
    <Suspense fallback={null}>
      <LazyGroupDialog
        snapshot={props.snapshot}
        group={props.group}
        close={props.close}
        saved={props.saved}
        lootChanged={props.lootChanged}
        inspect={(creature) => props.inspect(creature.id, creature.name)}
        onError={props.onError}
        reinforcementMode={props.reinforcementMode}
      />
    </Suspense>
  )
}
