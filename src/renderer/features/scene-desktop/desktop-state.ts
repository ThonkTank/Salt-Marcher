import type {
  DesktopBounds,
  SceneDesktopState,
  SceneDesktopWindow
} from '../../../shared/contracts/scene-desktop.js'

export const initialOverviewWindow: SceneDesktopWindow = {
  id: 'overview',
  kind: 'overview',
  bounds: { x: 20, y: 20, width: 380, height: 420 },
  minimized: false,
  maximized: false,
  snap: null
}
export function initialDesktopState(): SceneDesktopState {
  return { schemaVersion: 1, windows: [initialOverviewWindow] }
}
export type DesktopAction =
  | Readonly<{ type: 'open-overview' }>
  | Readonly<{ type: 'close' | 'minimize' | 'raise' | 'maximize'; id: string }>
  | Readonly<{ type: 'snap'; id: string; side: 'left' | 'right' | null }>
  | Readonly<{ type: 'bounds'; id: string; bounds: DesktopBounds }>

export function reduceDesktop(
  state: SceneDesktopState,
  action: DesktopAction
): SceneDesktopState {
  if (action.type === 'open-overview') {
    if (state.windows.some((window) => window.id === 'overview'))
      return reduceDesktop(state, { type: 'raise', id: 'overview' })
    return { ...state, windows: [...state.windows, initialOverviewWindow] }
  }
  if (action.type === 'close')
    return {
      ...state,
      windows: state.windows.filter((window) => window.id !== action.id)
    }
  const target = state.windows.find((window) => window.id === action.id)
  if (!target) return state
  const patch: Partial<SceneDesktopWindow> =
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
