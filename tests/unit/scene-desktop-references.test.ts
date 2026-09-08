import { describe, expect, it } from 'vitest'
import {
  initialDesktopState,
  reduceDesktop
} from '../../src/renderer/features/scene-desktop/desktop-state.js'
import {
  readStoredDesktopState,
  sceneDesktopStateSchema,
  saveSceneDesktopInputSchema,
  type DesktopReferenceEntry
} from '../../src/shared/contracts/scene-desktop.js'
import {
  referenceTargetKey,
  compileReferenceIndex,
  searchReferenceIndices
} from '../../src/renderer/features/reference/reference-matcher.js'
const item: DesktopReferenceEntry = {
  target: {
    scope: 'srd',
    catalogId: 'srd-5.1',
    definitionKind: 'item',
    definitionId: 'longsword'
  },
  title: 'Longsword',
  scrollTop: 0
}
const spell: DesktopReferenceEntry = {
  target: {
    scope: 'srd',
    catalogId: 'srd-5.1',
    definitionKind: 'spell',
    definitionId: 'light'
  },
  title: 'Light',
  scrollTop: 0
}
const id = '00000000-0000-4000-8000-000000000008'
describe('desktop reference state', () => {
  it('refreshes only the matching reader title without changing scroll or geometry', () => {
    let state = reduceDesktop(initialDesktopState(), {
      type: 'open-reference',
      entry: { ...item, scrollTop: 180 }
    })
    const before = state.windows.find((window) => window.kind === 'reader')!
    state = reduceDesktop(state, {
      type: 'reference-title',
      id: 'reader',
      title: 'Renamed',
      entryKey: referenceTargetKey(spell.target),
      index: 0
    })
    expect(state.windows.find((window) => window.kind === 'reader')).toEqual(
      before
    )
    state = reduceDesktop(state, {
      type: 'reference-title',
      id: 'reader',
      title: 'Renamed',
      entryKey: referenceTargetKey(item.target),
      index: 0
    })
    const after = state.windows.find((window) => window.kind === 'reader')!
    expect(after.entries[0]).toEqual({
      ...item,
      title: 'Renamed',
      scrollTop: 180
    })
    expect(after.bounds).toEqual(before.bounds)
  })

  it('keeps scroll per history entry, guards stale scroll and truncates forward navigation', () => {
    let state = reduceDesktop(initialDesktopState(), {
      type: 'open-reference',
      entry: item
    })
    state = reduceDesktop(state, {
      type: 'scroll',
      id: 'reader',
      value: 210,
      entryKey: referenceTargetKey(item.target),
      index: 0
    })
    state = reduceDesktop(state, { type: 'open-reference', entry: spell })
    state = reduceDesktop(state, {
      type: 'scroll',
      id: 'reader',
      value: 500,
      entryKey: referenceTargetKey(item.target),
      index: 0
    })
    state = reduceDesktop(state, { type: 'history', offset: -1 })
    let reader = state.windows.find((window) => window.kind === 'reader')!
    expect(reader.entries[reader.index]).toEqual({ ...item, scrollTop: 210 })
    state = reduceDesktop(state, { type: 'open-reference', entry: item })
    reader = state.windows.find((window) => window.kind === 'reader')!
    expect(reader.entries.map((entry) => entry.title)).toEqual([
      'Longsword',
      'Longsword'
    ])
    expect(sceneDesktopStateSchema.parse(state)).toEqual(state)
  })
  it('deduplicates separate references and raises a minimized existing reader without changing its geometry', () => {
    let state = reduceDesktop(initialDesktopState(), {
      type: 'open-reference',
      entry: item,
      separateId: id
    })
    state = reduceDesktop(state, { type: 'snap', id, side: 'right' })
    state = reduceDesktop(state, { type: 'minimize', id })
    state = reduceDesktop(state, {
      type: 'open-reference',
      entry: item,
      separateId: '00000000-0000-4000-8000-000000000009'
    })
    expect(state.windows).toHaveLength(2)
    expect(state.windows.at(-1)).toMatchObject({
      id,
      minimized: false,
      snap: 'right'
    })
  })
  it('upgrades old presentation documents without resurrecting closed windows or accepting malformed history', () => {
    expect(readStoredDesktopState({ schemaVersion: 1, windows: [] })).toEqual({
      schemaVersion: 2,
      windows: []
    })
    expect(
      readStoredDesktopState({ ...initialDesktopState(), schemaVersion: 1 })
    ).toEqual(initialDesktopState())
    const state = reduceDesktop(initialDesktopState(), {
      type: 'open-reference',
      entry: item
    })
    expect(() =>
      sceneDesktopStateSchema.parse({
        ...state,
        windows: [...state.windows, state.windows[0]]
      })
    ).toThrow()
    expect(() =>
      sceneDesktopStateSchema.parse({
        ...state,
        windows: state.windows.map((window) =>
          window.kind === 'reader' ? { ...window, index: 1 } : window
        )
      })
    ).toThrow()
    expect(() =>
      readStoredDesktopState({ schemaVersion: 99, windows: [] })
    ).toThrow()
  })
  it('rejects a campaign target from another campaign at the IPC boundary', () => {
    const state = reduceDesktop(initialDesktopState(), {
      type: 'open-reference',
      entry: {
        ...item,
        target: {
          scope: 'campaign',
          campaignId: id,
          entityKind: 'location',
          entityId: 'place'
        }
      }
    })
    expect(() =>
      saveSceneDesktopInputSchema.parse({
        campaignId: '00000000-0000-4000-8000-000000000001',
        sceneId: id,
        expectedRevision: 0,
        state
      })
    ).toThrow()
  })
  it('searches existing aliases and deduplicates candidate matches', () => {
    const index = compileReferenceIndex({
      scope: 'static',
      revision: 'test',
      terms: [
        { term: 'Longsword', matchMode: 'folded', candidates: [item] },
        { term: 'Langschwert', matchMode: 'folded', candidates: [item] }
      ]
    })
    expect(searchReferenceIndices([index], 'langschwert')).toEqual([item])
    expect(searchReferenceIndices([index], 'long')).toEqual([item])
    expect(searchReferenceIndices([index], 'missing')).toEqual([])
  })
})
