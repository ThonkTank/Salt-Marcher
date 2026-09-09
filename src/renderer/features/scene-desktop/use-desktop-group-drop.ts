import { useContext, useRef, useState } from 'react'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { WorkspaceSurfaceProps } from '../workspace/workspace-surface-props.js'
import type { DesktopProjection } from './desktop-projection.js'
import { droppableGroup, type GroupDrag } from './desktop-group-drop.js'
export function useDesktopGroupDrop(
  props: WorkspaceSurfaceProps,
  projection: DesktopProjection
) {
  const focused = props.snapshot.scene.scenes.find(
    (s) => s.id === props.snapshot.scene.focusedSceneId
  )!
  const api = useCapabilityApi()
  const workspace = useContext(CapabilityContext)!.campaignWorkspace
  const commands = useAsyncCommandCoordinator()
  const [drag, setDrag] = useState<GroupDrag | null>(null)
  const joining = useRef(false)
  const scopeKey = `${props.campaignId}:${focused.id}`
  const [dragScope, setDragScope] = useState(scopeKey)
  if (dragScope !== scopeKey) {
    setDragScope(scopeKey)
    setDrag(null)
  }
  async function dropGroup(payload: unknown) {
    const group = droppableGroup(payload, props.campaignId, props.snapshot)
    setDrag(null)
    if (!group || joining.current) return
    if (!props.snapshot.combat) {
      const selected = projection.snapshot().state?.combatSelection ?? []
      if (!selected.includes(group.id))
        projection.dispatch({
          type: 'combat-selection',
          value: [...selected, group.id]
        })
      return
    }
    if (props.snapshot.combat.selectedGroupIds.includes(group.id)) return
    joining.current = true
    const outcome = await commands.run({
      scope: 'desktop-group-drop',
      entityKey: `${props.campaignId}:${focused.id}`,
      mode: 'queue',
      execute: async () => {
        await api.combat.joinGroup({
          sceneId: focused.id,
          groupId: group.id,
          expectedGroupRevision: group.revision,
          expectedCombatRevision: props.snapshot.combat!.revision
        })
        return workspace.refreshActiveSession()
      },
      accept: (result) => {
        if (result.status === 'failure')
          props.onError(capabilityErrorText(result.cause))
      }
    })
    if (outcome.status === 'failure') {
      props.onError(capabilityErrorText(outcome.cause))
      await workspace.refreshActiveSession()
    }
    joining.current = false
  }

  return { drag, setDrag, dropGroup, scopeKey }
}
