import { useReducer } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'

export type DetailHistory = Readonly<{
  entries: readonly Creature[]
  index: number
}>
export type DetailHistoryState = Readonly<Record<string, DetailHistory>>
export type DetailHistoryAction =
  | Readonly<{ type: 'open'; sceneId: string; creature: Creature }>
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
  if (previous.entries[previous.index]?.id === action.creature.id) return state
  const entries = [
    ...previous.entries.slice(0, previous.index + 1),
    action.creature
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
    detail: history.entries[history.index] ?? null,
    openDetail: (creature: Creature) =>
      dispatch({ type: 'open', sceneId, creature }),
    moveHistory: (offset: number) =>
      dispatch({ type: 'move', sceneId, offset }),
    closeDetail: () => dispatch({ type: 'close', sceneId })
  } as const
}
