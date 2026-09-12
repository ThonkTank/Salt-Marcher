import { describe, expect, it } from 'vitest'
import {
  initialDesktopState,
  reduceDesktop
} from '../../src/renderer/features/scene-desktop/desktop-state.js'
import { desktopWindowIsVisible } from '../../src/renderer/features/scene-desktop/desktop-geometry.js'
import {
  readStoredDesktopState,
  sceneDesktopStateSchema
} from '../../src/shared/contracts/scene-desktop.js'

const mapId = '00000000-0000-4000-8000-000000000001'
describe('scene play window presentation', () => {
  it('retains camera, selection and encounter preparation after all windows close', () => {
    let state = reduceDesktop(initialDesktopState(), { type: 'open-map' })
    state = reduceDesktop(state, {
      type: 'map-view',
      value: {
        mapId,
        selected: { q: 8, r: -4 },
        cameras: [{ mapId, x: -550, y: 400, scale: 1.8 }]
      }
    })
    state = reduceDesktop(state, { type: 'combat-selection', value: [mapId] })
    state = reduceDesktop(state, { type: 'close', id: 'map' })
    state = reduceDesktop(state, { type: 'close', id: 'party' })
    state = reduceDesktop(state, { type: 'close', id: 'groups' })
    const restored = readStoredDesktopState(JSON.parse(JSON.stringify(state)))
    expect(restored.windows).toEqual([])
    expect(restored.mapView).toEqual(state.mapView)
    expect(restored.combatSelection).toEqual([mapId])
    expect(reduceDesktop(restored, { type: 'open-map' }).mapView).toEqual(
      state.mapView
    )
  })
  it('upgrades version 2 and rejects invalid presentation without dropping old readers', () => {
    const previous = reduceDesktop(initialDesktopState(), {
      type: 'open-search'
    })
    const restored = readStoredDesktopState({
      schemaVersion: 2,
      windows: [
        ...[
          {
            ...initialDesktopState().windows[0],
            id: 'overview',
            kind: 'overview'
          }
        ],
        ...previous.windows.filter((w) => w.kind === 'search')
      ]
    })
    expect(restored).toEqual({
      ...previous,
      windows: previous.windows.map((window) =>
        window.kind === 'groups'
          ? {
              ...window,
              bounds: {
                ...previous.windows[0]!.bounds,
                x: previous.windows[0]!.bounds.x + 40,
                y: previous.windows[0]!.bounds.y + 40
              }
            }
          : window
      )
    })
    expect(() =>
      sceneDesktopStateSchema.parse({
        ...restored,
        mapView: {
          mapId,
          selected: null,
          cameras: [{ mapId, x: Infinity, y: 0, scale: 1 }]
        }
      })
    ).toThrow()
  })
  it('pauses only fully covered maps including coverage by adjacent windows', () => {
    let state = reduceDesktop(initialDesktopState(), { type: 'open-map' })
    state = reduceDesktop(state, { type: 'maximize', id: 'map' })
    state = reduceDesktop(state, { type: 'open-search' })
    state = reduceDesktop(state, { type: 'snap', id: 'search', side: 'left' })
    const map = state.windows.find((window) => window.kind === 'map')!
    const size = { width: 1000, height: 700 }
    expect(desktopWindowIsVisible(map, state.windows, size)).toBe(true)
    state = reduceDesktop(state, { type: 'open-combat' })
    state = reduceDesktop(state, { type: 'snap', id: 'combat', side: 'right' })
    expect(desktopWindowIsVisible(map, state.windows, size)).toBe(false)
    state = reduceDesktop(state, { type: 'minimize', id: 'combat' })
    expect(desktopWindowIsVisible(map, state.windows, size)).toBe(true)
    state = reduceDesktop(state, { type: 'raise', id: 'map' })
    expect(
      desktopWindowIsVisible(state.windows.at(-1)!, state.windows, size)
    ).toBe(true)
  })
})
