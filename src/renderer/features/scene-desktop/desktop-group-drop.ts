import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
export const groupDragMime = 'application/x-saltmarcher-scene-group'
export type GroupDrag = Readonly<{
  campaignId: string
  sceneId: string
  groupId: string
}>
function isGroupDrag(value: unknown): value is GroupDrag {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 3 &&
    'campaignId' in value &&
    typeof value.campaignId === 'string' &&
    'sceneId' in value &&
    typeof value.sceneId === 'string' &&
    'groupId' in value &&
    typeof value.groupId === 'string'
  )
}
export function droppableGroup(
  payload: unknown,
  campaignId: string,
  snapshot: LiveSessionSnapshot
) {
  if (
    !isGroupDrag(payload) ||
    payload.campaignId !== campaignId ||
    payload.sceneId !== snapshot.scene.focusedSceneId ||
    snapshot.combat?.phase === 'resolution'
  )
    return null
  const scene = snapshot.scene.scenes.find((s) => s.id === payload.sceneId)
  return (
    scene?.groups.find(
      (g) =>
        g.id === payload.groupId &&
        !g.archived &&
        g.entries.some((e) => e.aliveQuantity > 0)
    ) ?? null
  )
}
