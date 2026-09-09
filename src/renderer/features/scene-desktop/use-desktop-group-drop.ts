import { useState } from 'react'
import type { WorkspaceSurfaceProps } from '../workspace/workspace-surface-props.js'
import type { DesktopProjection } from './desktop-projection.js'
import type { useCombatCommands } from '../encounter/use-combat-commands.js'
import { droppableGroup, type GroupDrag } from './desktop-group-drop.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
export function useDesktopGroupDrop(
  props: WorkspaceSurfaceProps,
  projection: DesktopProjection,
  commands: ReturnType<typeof useCombatCommands>
) {
  const [drag, setDrag] = useState<GroupDrag | null>(null)
  const scopeKey = `${props.campaignId}:${props.snapshot.scene.focusedSceneId}`
  const [dragScope, setDragScope] = useState(scopeKey)
  if (dragScope !== scopeKey) {
    setDragScope(scopeKey)
    setDrag(null)
  }
  function dropGroup(payload: unknown) {
    const group = droppableGroup(payload, props.campaignId, props.snapshot)
    setDrag(null)
    if (
      !group ||
      commands.blocked() ||
      maintenanceDraftCoordinator.isLocked() ||
      projection.snapshot().error
    )
      return
    if (!props.snapshot.combat) {
      const selected = projection.snapshot().state?.combatSelection ?? []
      if (!selected.includes(group.id))
        projection.dispatch({
          type: 'combat-selection',
          value: [...selected, group.id]
        })
    } else {
      commands.request((current) => {
        const currentGroup = droppableGroup(payload, props.campaignId, current)
        if (
          !currentGroup ||
          !current.combat ||
          current.combat.selectedGroupIds.includes(currentGroup.id)
        )
          return null
        return {
          kind: 'joinGroup',
          input: {
            sceneId: current.scene.focusedSceneId,
            groupId: currentGroup.id,
            expectedGroupRevision: currentGroup.revision,
            expectedCombatRevision: current.combat.revision
          }
        }
      })
    }
  }
  return { drag, setDrag, dropGroup, scopeKey }
}
