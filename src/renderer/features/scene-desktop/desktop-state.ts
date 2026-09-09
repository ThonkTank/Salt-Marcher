import type {
  CharacterComparison,
  DesktopBounds,
  DesktopMapView,
  DesktopReferenceEntry,
  SceneDesktopState,
  SceneDesktopWindow
} from '../../../shared/contracts/scene-desktop.js'

import { referenceTargetKey } from '../../../shared/reference/reference-target-key.js'

export const initialPartyWindow = {
  id: 'party',
  kind: 'party',
  bounds: { x: 20, y: 20, width: 380, height: 420 },
  minimized: false,
  maximized: false,
  snap: null
} satisfies SceneDesktopWindow
export function initialDesktopState(): SceneDesktopState {
  return {
    schemaVersion: 5,
    windows: [
      initialPartyWindow,
      {
        ...initialPartyWindow,
        id: 'groups',
        kind: 'groups',
        bounds: { x: 60, y: 60, width: 380, height: 420 }
      }
    ],
    mapView: { mapId: null, selected: null, cameras: [] },
    combatSelection: []
  }
}
export type DesktopAction =
  | Readonly<{ type: 'open-characters' }>
  | Readonly<{ type: 'character-comparison'; value: CharacterComparison }>
  | Readonly<{ type: 'open-party' }>
  | Readonly<{ type: 'open-groups' }>
  | Readonly<{ type: 'open-search' }>
  | Readonly<{ type: 'open-map' }>
  | Readonly<{ type: 'open-combat' }>
  | Readonly<{ type: 'open-loot' }>
  | Readonly<{ type: 'map-view'; value: DesktopMapView }>
  | Readonly<{ type: 'map-controls'; value: boolean }>
  | Readonly<{ type: 'combat-selection'; value: readonly string[] }>
  | Readonly<{
      type: 'open-reference'
      entry: DesktopReferenceEntry
      separateId?: string
    }>
  | Readonly<{
      type: 'reference-title'
      id: string
      title: string
      entryKey: string
      index?: number
    }>
  | Readonly<{ type: 'query'; value: string }>
  | Readonly<{ type: 'history'; offset: number }>
  | Readonly<{
      type: 'scroll'
      id: string
      value: number
      entryKey?: string
      index?: number
    }>
  | Readonly<{ type: 'close' | 'minimize' | 'raise' | 'maximize'; id: string }>
  | Readonly<{ type: 'snap'; id: string; side: 'left' | 'right' | null }>
  | Readonly<{ type: 'bounds'; id: string; bounds: DesktopBounds }>

export function reduceDesktop(
  state: SceneDesktopState,
  action: DesktopAction
): SceneDesktopState {
  if (action.type === 'character-comparison')
    return {
      ...state,
      windows: state.windows.map((window) =>
        window.kind === 'characters'
          ? { ...window, comparison: action.value }
          : window
      )
    }
  if (action.type === 'open-characters') {
    if (state.windows.some((window) => window.id === 'characters'))
      return reduceDesktop(state, { type: 'raise', id: 'characters' })
    return appendWindow(state, {
      ...initialPartyWindow,
      id: 'characters',
      kind: 'characters',
      comparison: { language: '', passive: 'passivePerception', minimum: null },
      bounds: { x: 60, y: 40, width: 600, height: 480 }
    })
  }
  if (action.type === 'map-view') return { ...state, mapView: action.value }
  if (action.type === 'combat-selection')
    return { ...state, combatSelection: action.value }
  if (action.type === 'map-controls')
    return {
      ...state,
      windows: state.windows.map((window) =>
        window.kind === 'map'
          ? { ...window, controlsOpen: action.value }
          : window
      )
    }
  if (
    action.type === 'open-map' ||
    action.type === 'open-combat' ||
    action.type === 'open-loot'
  ) {
    const kind =
      action.type === 'open-map'
        ? 'map'
        : action.type === 'open-combat'
          ? 'combat'
          : 'loot'
    if (state.windows.some((window) => window.id === kind))
      return reduceDesktop(state, { type: 'raise', id: kind })
    return appendWindow(state, {
      ...initialPartyWindow,
      id: kind,
      kind,
      ...(kind === 'map' ? { controlsOpen: false } : {}),
      bounds: { x: 80, y: 40, width: kind === 'map' ? 720 : 600, height: 560 }
    } as SceneDesktopWindow)
  }
  if (
    action.type === 'open-party' ||
    action.type === 'open-groups' ||
    action.type === 'open-search'
  ) {
    const id =
      action.type === 'open-party'
        ? 'party'
        : action.type === 'open-groups'
          ? 'groups'
          : 'search'
    if (state.windows.some((window) => window.id === id))
      return reduceDesktop(state, { type: 'raise', id })
    return appendWindow(
      state,
      id !== 'search'
        ? id === 'party'
          ? initialPartyWindow
          : { ...initialPartyWindow, id: 'groups', kind: 'groups' }
        : {
            ...initialPartyWindow,
            id,
            kind: 'search',
            query: '',
            scrollTop: 0,
            bounds: { x: 50, y: 30, width: 380, height: 480 }
          }
    )
  }
  if (action.type === 'open-reference') {
    if (action.separateId) {
      const existing = state.windows.find(
        (window) =>
          window.kind === 'reference' &&
          referenceTargetKey(window.entry.target) ===
            referenceTargetKey(action.entry.target)
      )
      return existing
        ? reduceDesktop(state, { type: 'raise', id: existing.id })
        : appendWindow(state, {
            ...initialPartyWindow,
            id: action.separateId,
            kind: 'reference',
            entry: action.entry,
            bounds: readerBounds(state)
          })
    }
    const reader = state.windows.find((window) => window.kind === 'reader')
    if (reader?.kind === 'reader') {
      const entries = [
        ...reader.entries.slice(0, reader.index + 1),
        action.entry
      ].slice(-100)
      return reduceDesktop(
        {
          ...state,
          windows: state.windows.map((window) =>
            window.id === reader.id
              ? { ...reader, entries, index: entries.length - 1 }
              : window
          )
        },
        { type: 'raise', id: reader.id }
      )
    }
    return appendWindow(state, {
      ...initialPartyWindow,
      id: 'reader',
      kind: 'reader',
      entries: [action.entry],
      index: 0,
      bounds: readerBounds(state)
    })
  }
  if (action.type === 'reference-title')
    return {
      ...state,
      windows: state.windows.map((window) => {
        if (window.id !== action.id) return window
        const title = action.title.slice(0, 300)
        if (!title) return window
        if (
          window.kind === 'reference' &&
          referenceTargetKey(window.entry.target) === action.entryKey
        )
          return { ...window, entry: { ...window.entry, title } }
        if (
          window.kind === 'reader' &&
          window.index === action.index &&
          referenceTargetKey(window.entries[window.index]!.target) ===
            action.entryKey
        )
          return {
            ...window,
            entries: window.entries.map((entry, index) =>
              index === window.index ? { ...entry, title } : entry
            )
          }
        return window
      })
    }
  if (
    action.type === 'query' ||
    action.type === 'history' ||
    action.type === 'scroll'
  )
    return {
      ...state,
      windows: state.windows.map((window) => {
        if (action.type === 'query')
          return window.kind === 'search'
            ? { ...window, query: action.value, scrollTop: 0 }
            : window
        if (action.type === 'history')
          return window.kind === 'reader'
            ? {
                ...window,
                index: Math.max(
                  0,
                  Math.min(
                    window.entries.length - 1,
                    window.index + action.offset
                  )
                )
              }
            : window
        if (window.id !== action.id) return window
        const scrollTop = Math.max(
          0,
          Math.min(10_000_000, Math.round(action.value))
        )
        if (window.kind === 'search') return { ...window, scrollTop }
        if (
          window.kind === 'reference' &&
          referenceTargetKey(window.entry.target) === action.entryKey
        )
          return { ...window, entry: { ...window.entry, scrollTop } }
        if (
          window.kind === 'reader' &&
          window.index === action.index &&
          referenceTargetKey(window.entries[window.index]!.target) ===
            action.entryKey
        )
          return {
            ...window,
            entries: window.entries.map((entry, index) =>
              index === window.index ? { ...entry, scrollTop } : entry
            )
          }
        return window
      })
    }
  if (action.type === 'close')
    return {
      ...state,
      windows: state.windows.filter((window) => window.id !== action.id)
    }
  const target = state.windows.find((window) => window.id === action.id)
  if (!target) return state
  const patch: Partial<
    Pick<SceneDesktopWindow, 'bounds' | 'minimized' | 'maximized' | 'snap'>
  > =
    action.type === 'minimize'
      ? { minimized: true }
      : action.type === 'maximize'
        ? { maximized: !target.maximized, minimized: false }
        : action.type === 'snap'
          ? { snap: action.side, maximized: false, minimized: false }
          : action.type === 'bounds'
            ? { bounds: action.bounds, maximized: false, snap: null }
            : { minimized: false }
  const changed = { ...target, ...patch }
  return {
    ...state,
    windows:
      action.type === 'raise'
        ? [
            ...state.windows.filter((window) => window.id !== action.id),
            changed
          ]
        : state.windows.map((window) =>
            window.id === action.id ? changed : window
          )
  }
}

function appendWindow(
  state: SceneDesktopState,
  window: SceneDesktopWindow
): SceneDesktopState {
  // Do not evict an existing document to make room for another one.
  return state.windows.length >= 33
    ? state
    : { ...state, windows: [...state.windows, window] }
}
function readerBounds(state: SceneDesktopState): DesktopBounds {
  const offset = (state.windows.length % 6) * 24
  return { x: 90 + offset, y: 40 + offset, width: 500, height: 560 }
}
