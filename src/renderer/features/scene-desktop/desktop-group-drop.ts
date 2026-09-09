import { z } from 'zod'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
export const groupDragMime = 'application/x-saltmarcher-scene-group'
export const groupDragSchema = z
  .object({ campaignId: z.uuid(), sceneId: z.uuid(), groupId: z.uuid() })
  .strict()
export type GroupDrag = z.infer<typeof groupDragSchema>
export function droppableGroup(
  payload: unknown,
  campaignId: string,
  snapshot: LiveSessionSnapshot
) {
  const parsed = groupDragSchema.safeParse(payload)
  if (
    !parsed.success ||
    parsed.data.campaignId !== campaignId ||
    parsed.data.sceneId !== snapshot.scene.focusedSceneId ||
    snapshot.combat?.phase === 'resolution'
  )
    return null
  const scene = snapshot.scene.scenes.find((s) => s.id === parsed.data.sceneId)
  return (
    scene?.groups.find(
      (g) =>
        g.id === parsed.data.groupId &&
        !g.archived &&
        g.entries.some((e) => e.aliveQuantity > 0)
    ) ?? null
  )
}
