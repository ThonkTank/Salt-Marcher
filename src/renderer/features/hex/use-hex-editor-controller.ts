import { useMemo, useReducer, type SetStateAction } from 'react'
import type {
  AxialCoordinate,
  HexEraseImpact,
  HexHistoryState,
  HexMapCatalogSnapshot,
  HexMapView,
  HexTerrainCatalog,
  HexTerrainId
} from '../../../shared/contracts/hex.js'
import type { WorldLocationSnapshot } from '../../../shared/contracts/world-location.js'

export type EditorTool = 'select' | 'paint' | 'erase' | 'location'
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

type State = Readonly<{
  catalog: Readonly<{
    maps: HexMapCatalogSnapshot | null
    terrains: HexTerrainCatalog | null
    locations: WorldLocationSnapshot | null
  }>
  activeMap: Readonly<{
    map: HexMapView | null
    selected: AxialCoordinate | null
    overlays: readonly EditorOverlay[]
    newName: string
    name: string
  }>
  viewport: Readonly<{ resetSignal: number }>
  tool: Readonly<{
    kind: EditorTool
    terrainId: HexTerrainId
    radius: number
    locationId: string
  }>
  command: Readonly<{ history: HexHistoryState }>
  confirmation: Readonly<{
    erase: PendingErase | null
    history: PendingHistory | null
  }>
}>
type Action = Readonly<{ apply: (state: State) => State }>

const initialState: State = {
  catalog: { maps: null, terrains: null, locations: null },
  activeMap: {
    map: null,
    selected: null,
    overlays: [],
    newName: 'Neue Hex-Karte',
    name: ''
  },
  viewport: { resetSignal: 0 },
  tool: { kind: 'select', terrainId: 'grassland', radius: 0, locationId: '' },
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

function reducer(state: State, action: Action): State {
  return action.apply(state)
}
function resolve<T>(current: T, action: SetStateAction<T>): T {
  return typeof action === 'function'
    ? (action as (value: T) => T)(current)
    : action
}

/** Owns catalog, active map, viewport, tool, command and confirmation independently. */
export function useHexEditorController() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const setters = useMemo(() => {
    const setter =
      <Group extends keyof State, Key extends keyof State[Group]>(
        group: Group,
        key: Key
      ) =>
      (action: SetStateAction<State[Group][Key]>) =>
        dispatch({
          apply: (current) => ({
            ...current,
            [group]: {
              ...current[group],
              [key]: resolve(current[group][key], action)
            }
          })
        })
    return {
      setCatalog: setter('catalog', 'maps'),
      setTerrains: setter('catalog', 'terrains'),
      setLocations: setter('catalog', 'locations'),
      setMap: setter('activeMap', 'map'),
      setSelected: setter('activeMap', 'selected'),
      setOverlays: setter('activeMap', 'overlays'),
      setNewName: setter('activeMap', 'newName'),
      setName: setter('activeMap', 'name'),
      setResetViewSignal: setter('viewport', 'resetSignal'),
      setTool: setter('tool', 'kind'),
      setTerrainId: setter('tool', 'terrainId'),
      setRadius: setter('tool', 'radius'),
      setLocationId: setter('tool', 'locationId'),
      setHistory: setter('command', 'history'),
      setPendingErase: setter('confirmation', 'erase'),
      setPendingHistory: setter('confirmation', 'history')
    }
  }, [])
  return {
    catalog: state.catalog.maps,
    terrains: state.catalog.terrains,
    locations: state.catalog.locations,
    map: state.activeMap.map,
    selected: state.activeMap.selected,
    overlays: state.activeMap.overlays,
    newName: state.activeMap.newName,
    name: state.activeMap.name,
    resetViewSignal: state.viewport.resetSignal,
    tool: state.tool.kind,
    terrainId: state.tool.terrainId,
    radius: state.tool.radius,
    locationId: state.tool.locationId,
    history: state.command.history,
    pendingErase: state.confirmation.erase,
    pendingHistory: state.confirmation.history,
    ...setters
  }
}
