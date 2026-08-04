import { useReducer } from 'react'
import type {
  ReferenceDocument,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'

export type DetailHistory = Readonly<{
  entries: readonly DetailHistoryEntry[]
  index: number
}>
export type DetailHistoryEntry = Readonly<{
  target: ReferenceTarget
  document: ReferenceDocument
  breadcrumb: string
}>
export type DetailHistoryState = Readonly<Record<string, DetailHistory>>
export type DetailHistoryAction =
  | Readonly<{
      type: 'open'
      sceneId: string
      entry: DetailHistoryEntry
    }>
  | Readonly<{ type: 'move'; sceneId: string; offset: number }>
  | Readonly<{ type: 'close'; sceneId: string }>

const emptyHistory: DetailHistory = { entries: [], index: -1 }

export function reduceDetailHistory(
  state: DetailHistoryState,
  action: DetailHistoryAction
): DetailHistoryState {
  const previous = state[action.sceneId] ?? emptyHistory
  if (action.type === 'close')
    return { ...state, [action.sceneId]: emptyHistory }
  if (action.type === 'move')
    return {
      ...state,
      [action.sceneId]: {
        ...previous,
        index: Math.max(
          -1,
          Math.min(previous.entries.length - 1, previous.index + action.offset)
        )
      }
    }
  const current = previous.entries[previous.index]
  if (
    current &&
    sameTarget(current.target, action.entry.target) &&
    current.breadcrumb === action.entry.breadcrumb
  )
    return state
  const entries = [
    ...previous.entries.slice(0, previous.index + 1),
    action.entry
  ]
  return {
    ...state,
    [action.sceneId]: { entries, index: entries.length - 1 }
  }
}

export function useSessionDetailHistory(sceneId: string) {
  const [state, dispatch] = useReducer(reduceDetailHistory, {})
  const history = state[sceneId] ?? emptyHistory
  return {
    history,
    detail: history.entries[history.index]?.document ?? null,
    breadcrumb: history.entries[history.index]?.breadcrumb ?? null,
    openDetail: (document: ReferenceDocument, breadcrumb: string) =>
      dispatch({
        type: 'open',
        sceneId,
        entry: { target: document.target, document, breadcrumb }
      }),
    moveHistory: (offset: number) =>
      dispatch({ type: 'move', sceneId, offset }),
    closeDetail: () => dispatch({ type: 'close', sceneId })
  } as const
}

function sameTarget(
  left: ReferenceTarget | undefined,
  right: ReferenceTarget
): boolean {
  return (
    left !== undefined &&
    left.kind === right.kind &&
    left.id === right.id &&
    left.sectionId === right.sectionId
  )
}
