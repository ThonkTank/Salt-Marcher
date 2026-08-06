import { useReducer, type SetStateAction } from 'react'
import type {
  AxialCoordinate,
  HexEraseImpact,
  HexHistoryState,
  HexMapCatalogSnapshot,
  HexMapView,
  HexTerrainCatalog,
  HexTerrainId
} from '../../../shared/contracts/hex.js'
import type { LocationSymbolPage } from '../../../shared/contracts/location-symbol.js'

export type EditorTool = 'select' | 'terrain' | 'location'
export type TerrainMode = 'paint' | 'erase'
export type PendingErase = Readonly<{
  path: readonly AxialCoordinate[]
  radius: number
  commandId: string
  confirmationToken: string
  impact: HexEraseImpact
}>
export type EditorOverlay = Readonly<{
  id: string
  label: string
  token: AxialCoordinate | null
  route: readonly AxialCoordinate[]
  focused: boolean
}>
export type PendingHistory = Readonly<{
  direction: 'undo' | 'redo'
  commandId: string
  confirmationToken: string
  impact: HexEraseImpact
}>

export type HexEditorState = Readonly<{
  catalog: Readonly<{
    maps: HexMapCatalogSnapshot | null
    terrains: HexTerrainCatalog | null
    symbols: LocationSymbolPage | null
  }>
  activeMap: Readonly<{
    map: HexMapView | null
    selected: AxialCoordinate | null
    overlays: readonly EditorOverlay[]
    name: string
  }>
  viewport: Readonly<{ resetSignal: number }>
  tool: Readonly<{
    kind: EditorTool
    terrainMode: TerrainMode
    terrainId: HexTerrainId
    brushLevel: number
    locationId: string
  }>
  command: Readonly<{ history: HexHistoryState }>
  confirmation: Readonly<{
    erase: PendingErase | null
    history: PendingHistory | null
  }>
}>

type Update<T> = SetStateAction<T>
export type HexEditorAction =
  | Readonly<{
      type: 'catalog.changed'
      key: keyof HexEditorState['catalog']
      value: Update<HexEditorState['catalog'][keyof HexEditorState['catalog']]>
    }>
  | Readonly<{
      type: 'map.changed'
      key: keyof HexEditorState['activeMap']
      value: Update<
        HexEditorState['activeMap'][keyof HexEditorState['activeMap']]
      >
    }>
  | Readonly<{ type: 'viewport.reset'; value: Update<number> }>
  | Readonly<{ type: 'tool.selected'; tool: EditorTool }>
  | Readonly<{ type: 'terrain.mode-selected'; mode: TerrainMode }>
  | Readonly<{ type: 'terrain.selected'; terrainId: HexTerrainId }>
  | Readonly<{ type: 'brush.level-changed'; level: number }>
  | Readonly<{ type: 'location.selected'; locationId: string }>
  | Readonly<{
      type: 'history.changed'
      history: Update<HexHistoryState>
    }>
  | Readonly<{
      type: 'confirmation.changed'
      kind: 'erase'
      value: Update<PendingErase | null>
    }>
  | Readonly<{
      type: 'confirmation.changed'
      kind: 'history'
      value: Update<PendingHistory | null>
    }>

export const initialHexEditorState: HexEditorState = {
  catalog: { maps: null, terrains: null, symbols: null },
  activeMap: {
    map: null,
    selected: null,
    overlays: [],
    name: ''
  },
  viewport: { resetSignal: 0 },
  tool: {
    kind: 'terrain',
    terrainMode: 'paint',
    terrainId: 'grassland',
    brushLevel: 1,
    locationId: ''
  },
  command: {
    history: {
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null
    }
  },
  confirmation: { erase: null, history: null }
}

function resolve<T>(current: T, update: Update<T>): T {
  return typeof update === 'function'
    ? (update as (value: T) => T)(current)
    : update
}

/** Explicit state machine for the editor's independent state domains. */
export function hexEditorReducer(
  state: HexEditorState,
  action: HexEditorAction
): HexEditorState {
  switch (action.type) {
    case 'catalog.changed':
      return {
        ...state,
        catalog: {
          ...state.catalog,
          [action.key]: resolve(state.catalog[action.key], action.value)
        }
      } as HexEditorState
    case 'map.changed':
      return {
        ...state,
        activeMap: {
          ...state.activeMap,
          [action.key]: resolve(state.activeMap[action.key], action.value)
        }
      } as HexEditorState
    case 'viewport.reset':
      return {
        ...state,
        viewport: {
          resetSignal: resolve(state.viewport.resetSignal, action.value)
        }
      }
    case 'tool.selected':
      return { ...state, tool: { ...state.tool, kind: action.tool } }
    case 'terrain.mode-selected':
      return { ...state, tool: { ...state.tool, terrainMode: action.mode } }
    case 'terrain.selected':
      return { ...state, tool: { ...state.tool, terrainId: action.terrainId } }
    case 'brush.level-changed':
      return { ...state, tool: { ...state.tool, brushLevel: action.level } }
    case 'location.selected':
      return {
        ...state,
        tool: { ...state.tool, locationId: action.locationId }
      }
    case 'history.changed':
      return {
        ...state,
        command: {
          history: resolve(state.command.history, action.history)
        }
      }
    case 'confirmation.changed':
      return {
        ...state,
        confirmation: {
          ...state.confirmation,
          [action.kind]: resolve(
            state.confirmation[action.kind],
            action.value as never
          )
        }
      } as HexEditorState
  }
}

export function useHexEditorController() {
  const [state, dispatch] = useReducer(hexEditorReducer, initialHexEditorState)
  const catalogSetter =
    <Key extends keyof HexEditorState['catalog']>(key: Key) =>
    (value: Update<HexEditorState['catalog'][Key]>) =>
      dispatch({ type: 'catalog.changed', key, value } as HexEditorAction)
  const mapSetter =
    <Key extends keyof HexEditorState['activeMap']>(key: Key) =>
    (value: Update<HexEditorState['activeMap'][Key]>) =>
      dispatch({ type: 'map.changed', key, value } as HexEditorAction)
  return {
    catalog: state.catalog.maps,
    terrains: state.catalog.terrains,
    symbols: state.catalog.symbols,
    map: state.activeMap.map,
    selected: state.activeMap.selected,
    overlays: state.activeMap.overlays,
    name: state.activeMap.name,
    resetViewSignal: state.viewport.resetSignal,
    tool: state.tool.kind,
    terrainMode: state.tool.terrainMode,
    terrainId: state.tool.terrainId,
    brushLevel: state.tool.brushLevel,
    locationId: state.tool.locationId,
    history: state.command.history,
    pendingErase: state.confirmation.erase,
    pendingHistory: state.confirmation.history,
    setCatalog: catalogSetter('maps'),
    setTerrains: catalogSetter('terrains'),
    setSymbols: catalogSetter('symbols'),
    setMap: mapSetter('map'),
    setSelected: mapSetter('selected'),
    setOverlays: mapSetter('overlays'),
    setName: mapSetter('name'),
    setResetViewSignal: (value: Update<number>) =>
      dispatch({ type: 'viewport.reset', value }),
    setTool: (tool: EditorTool) => dispatch({ type: 'tool.selected', tool }),
    setTerrainMode: (mode: TerrainMode) =>
      dispatch({ type: 'terrain.mode-selected', mode }),
    setTerrainId: (terrainId: HexTerrainId) =>
      dispatch({ type: 'terrain.selected', terrainId }),
    setBrushLevel: (level: number) =>
      dispatch({ type: 'brush.level-changed', level }),
    setLocationId: (locationId: string) =>
      dispatch({ type: 'location.selected', locationId }),
    setHistory: (history: Update<HexHistoryState>) =>
      dispatch({ type: 'history.changed', history }),
    setPendingErase: (value: Update<PendingErase | null>) =>
      dispatch({ type: 'confirmation.changed', kind: 'erase', value }),
    setPendingHistory: (value: Update<PendingHistory | null>) =>
      dispatch({ type: 'confirmation.changed', kind: 'history', value })
  }
}
