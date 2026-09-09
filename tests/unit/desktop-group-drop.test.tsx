// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { WorkspaceSurfaceProps } from '../../src/renderer/features/workspace/workspace-surface-props.js'
import type { DesktopProjection } from '../../src/renderer/features/scene-desktop/desktop-projection.js'
import type { useCombatCommands } from '../../src/renderer/features/encounter/use-combat-commands.js'
import { useDesktopGroupDrop } from '../../src/renderer/features/scene-desktop/use-desktop-group-drop.js'
import { initialDesktopState } from '../../src/renderer/features/scene-desktop/desktop-state.js'
const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneId = '00000000-0000-4000-8000-000000000002'
const groupId = '00000000-0000-4000-8000-000000000003'
const payload = { campaignId, sceneId, groupId }
const group = {
  id: groupId,
  revision: 7,
  archived: false,
  entries: [{ aliveQuantity: 1 }]
}
const props = {
  campaignId,
  snapshot: {
    scene: {
      focusedSceneId: sceneId,
      scenes: [{ id: sceneId, groups: [group] }]
    },
    combat: null
  }
} as unknown as WorkspaceSurfaceProps
afterEach(cleanup)
it('adds one preparation selection, preserves other selections and cancels pickup across scenes', () => {
  let state = initialDesktopState()
  const dispatch = vi.fn((action: { value: readonly string[] }) => {
    state = { ...state, combatSelection: action.value }
  })
  const projection = {
    snapshot: () => ({ state, error: null }),
    dispatch
  } as unknown as DesktopProjection
  const request = vi.fn()
  const commands = { blocked: () => false, request } as unknown as ReturnType<
    typeof useCombatCommands
  >
  const hook = renderHook(
    ({ value }) => useDesktopGroupDrop(value, projection, commands),
    { initialProps: { value: props } }
  )
  act(() => {
    hook.result.current.setDrag(payload)
    hook.result.current.dropGroup(payload)
    hook.result.current.dropGroup(payload)
  })
  expect(state.combatSelection).toEqual([groupId])
  expect(dispatch).toHaveBeenCalledOnce()
  expect(request).not.toHaveBeenCalled()
  act(() => hook.result.current.setDrag(payload))
  hook.rerender({
    value: {
      ...props,
      snapshot: {
        ...props.snapshot,
        scene: { ...props.snapshot.scene, focusedSceneId: groupId }
      }
    }
  })
  expect(hook.result.current.drag).toBeNull()
})
it('builds reinforcement from the latest combat revision and ignores already joined groups', () => {
  const projection = {
    snapshot: () => ({ state: initialDesktopState(), error: null }),
    dispatch: vi.fn()
  } as unknown as DesktopProjection
  const request = vi.fn<ReturnType<typeof useCombatCommands>['request']>()
  const commands = { blocked: () => false, request } as unknown as ReturnType<
    typeof useCombatCommands
  >
  const current = {
    ...props,
    snapshot: {
      ...props.snapshot,
      combat: { phase: 'combat', revision: 9, selectedGroupIds: [] }
    }
  } as unknown as WorkspaceSurfaceProps
  const hook = renderHook(() =>
    useDesktopGroupDrop(current, projection, commands)
  )
  act(() => hook.result.current.dropGroup(payload))
  const build = request.mock.calls[0]![0]
  const latest = {
    ...current.snapshot,
    combat: { ...current.snapshot.combat!, revision: 12 }
  }
  expect(build(latest)).toEqual({
    kind: 'joinGroup',
    input: {
      sceneId,
      groupId,
      expectedGroupRevision: 7,
      expectedCombatRevision: 12
    }
  })
  expect(
    build({
      ...latest,
      combat: { ...latest.combat, selectedGroupIds: [groupId] }
    })
  ).toBeNull()
  expect(
    build({ ...latest, combat: { ...latest.combat, phase: 'resolution' } })
  ).toBeNull()
})
