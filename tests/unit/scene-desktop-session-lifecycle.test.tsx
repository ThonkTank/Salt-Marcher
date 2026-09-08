// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSessionReferenceFollow } from '../../src/renderer/features/session/use-session-reference-follow.js'
import { useSessionDialogController } from '../../src/renderer/features/session/use-session-dialog-controller.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { ReferenceContextValue } from '../../src/renderer/features/reference/reference-context.js'

afterEach(cleanup)
it('leaves an open description untouched when desktop combat turns change, but supports explicit inspection', () => {
  const openReference = vi.fn()
  const reference = { openReference } as unknown as ReferenceContextValue
  const snapshot = (id: string) =>
    ({
      scene: {
        focusedSceneId: 'scene-a',
        scenes: [{ id: 'scene-a', groups: [] }]
      },
      combat: {
        cards: [
          { id, active: true, playerCharacter: false, creatureId: 'wolf' }
        ]
      }
    }) as unknown as LiveSessionSnapshot
  const hook = renderHook(
    ({ id }) =>
      useSessionReferenceFollow({
        snapshot: snapshot(id),
        reference,
        follow: false
      }),
    { initialProps: { id: 'card-1' } }
  )
  hook.rerender({ id: 'card-2' })
  expect(openReference).not.toHaveBeenCalled()
  act(() => hook.result.current.openCreature('wolf', 'Wölfe'))
  expect(openReference).toHaveBeenCalledWith(
    { scope: 'creature', creatureId: 'wolf' },
    expect.any(String)
  )
})
it('discards transient dialogs on scope changes without resurrecting them on return', () => {
  const hook = renderHook(({ scene }) => useSessionDialogController(scene), {
    initialProps: { scene: 'a' }
  })
  act(() => hook.result.current.manageGroups())
  expect(hook.result.current.dialog.kind).toBe('group-editor')
  hook.rerender({ scene: 'b' })
  expect(hook.result.current.dialog.kind).toBe('none')
  hook.rerender({ scene: 'a' })
  expect(hook.result.current.dialog.kind).toBe('none')
})
