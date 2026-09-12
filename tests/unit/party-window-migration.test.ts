import { expect, it } from 'vitest'
import { readStoredDesktopState } from '../../src/shared/contracts/scene-desktop.js'
import { initialPartyWindow } from '../../src/renderer/features/scene-desktop/desktop-state.js'
const party = {
  ...initialPartyWindow,
  bounds: { x: 12, y: 32, width: 380, height: 420 }
}
const characters = {
  ...party,
  id: 'characters',
  kind: 'characters',
  bounds: { x: 100, y: 90, width: 600, height: 480 },
  comparison: { language: 'Common', passive: 'passivePerception', minimum: 12 }
}
const search = {
  ...party,
  id: 'search',
  kind: 'search',
  query: 'Wolf',
  scrollTop: 40
}
function migrate(windows: unknown[]) {
  return readStoredDesktopState({
    schemaVersion: 5,
    windows,
    mapView: { mapId: null, selected: null, cameras: [] },
    combatSelection: []
  })
}
it('migrates either single window and keeps deliberately closed windows closed', () => {
  expect(migrate([characters]).windows).toEqual([
    { ...party, bounds: characters.bounds }
  ])
  expect(migrate([party]).windows).toEqual([party])
  expect(migrate([]).windows).toEqual([])
  expect(migrate([search]).windows).toEqual([search])
})
it.each([
  [true, true, true],
  [true, false, false],
  [false, true, false],
  [false, false, false]
])(
  'merges minimized states %s/%s with Party geometry and the frontmost stack position',
  (p, c, minimized) => {
    const state = migrate([
      { ...party, minimized: p },
      search,
      { ...characters, minimized: c }
    ])
    expect(state.schemaVersion).toBe(6)
    expect(state.windows).toEqual([search, { ...party, minimized }])
    expect(JSON.stringify(state)).not.toContain('comparison')
  }
)
