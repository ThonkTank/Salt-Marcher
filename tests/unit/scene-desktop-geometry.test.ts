import { describe, expect, it } from 'vitest'
import {
  alignDesktopBounds,
  desktopSnapPreview,
  desktopWindowBounds,
  fitDesktopBounds
} from '../../src/renderer/features/scene-desktop/desktop-geometry.js'
import {
  initialDesktopState,
  initialPartyWindow,
  reduceDesktop
} from '../../src/renderer/features/scene-desktop/desktop-state.js'
import { saveSceneDesktopInputSchema } from '../../src/shared/contracts/scene-desktop.js'

const size = { width: 1200, height: 700 }

describe('scene desktop geometry and state', () => {
  it('keeps preferred geometry when the viewport shrinks and restores it when room returns', () => {
    const window = {
      ...initialPartyWindow,
      bounds: { x: 600, y: 200, width: 500, height: 400 }
    }
    expect(desktopWindowBounds(window, { width: 300, height: 250 })).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 250
    })
    expect(desktopWindowBounds(window, size)).toEqual(window.bounds)
    expect(fitDesktopBounds(window.bounds, { width: 1, height: 1 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1
    })
  })

  it('restores snapped and normal geometry after maximize without destroying either', () => {
    const start = initialDesktopState()
    const snapped = reduceDesktop(start, {
      type: 'snap',
      id: 'party',
      side: 'right'
    })
    const max = reduceDesktop(snapped, { type: 'maximize', id: 'party' })
    expect(desktopWindowBounds(max.windows[0]!, size)).toEqual({
      x: 0,
      y: 0,
      ...size
    })
    const restored = reduceDesktop(max, { type: 'maximize', id: 'party' })
    expect(desktopWindowBounds(restored.windows[0]!, size)).toEqual({
      x: 600,
      y: 0,
      width: 600,
      height: 700
    })
    expect(
      reduceDesktop(restored, { type: 'snap', id: 'party', side: null })
    ).toEqual(start)
  })

  it('keeps minimized state, reopens a singleton, and leaves a closed desktop empty', () => {
    const minimized = reduceDesktop(initialDesktopState(), {
      type: 'minimize',
      id: 'party'
    })
    expect(minimized.windows[0]?.minimized).toBe(true)
    const reopened = reduceDesktop(minimized, { type: 'open-party' })
    expect(reopened.windows.at(-1)).toEqual(initialDesktopState().windows[0])
    const closed = reduceDesktop(
      reduceDesktop(reopened, { type: 'close', id: 'party' }),
      { type: 'close', id: 'groups' }
    )
    expect(closed.windows).toHaveLength(0)
    expect(reduceDesktop(closed, { type: 'raise', id: 'party' })).toBe(closed)
  })

  it('snaps near viewport and neighboring edges while keeping windows reachable', () => {
    expect(desktopSnapPreview(20, size)).toBe('left')
    expect(desktopSnapPreview(1190, size)).toBe('right')
    expect(desktopSnapPreview(600, size)).toBeNull()
    expect(desktopSnapPreview(1, { width: 400, height: 600 })).toBeNull()
    expect(
      alignDesktopBounds(
        { x: 407, y: 25, width: 300, height: 250 },
        [{ x: 20, y: 20, width: 380, height: 420 }],
        size
      )
    ).toEqual({ x: 400, y: 20, width: 300, height: 250 })
  })

  it('rejects malformed scope, geometry and window identities at the boundary', () => {
    const input = {
      campaignId: '00000000-0000-4000-8000-000000000001',
      sceneId: '00000000-0000-4000-8000-000000000002',
      expectedRevision: 0,
      state: initialDesktopState()
    }
    expect(saveSceneDesktopInputSchema.safeParse(input).success).toBe(true)
    expect(
      saveSceneDesktopInputSchema.safeParse({ ...input, sceneId: '' }).success
    ).toBe(false)
    expect(
      saveSceneDesktopInputSchema.safeParse({
        ...input,
        state: {
          ...input.state,
          windows: [
            {
              ...initialPartyWindow,
              bounds: { ...initialPartyWindow.bounds, x: -1 }
            }
          ]
        }
      }).success
    ).toBe(false)
    expect(
      saveSceneDesktopInputSchema.safeParse({
        ...input,
        state: {
          ...input.state,
          windows: [initialPartyWindow, initialPartyWindow]
        }
      }).success
    ).toBe(false)
  })
})
