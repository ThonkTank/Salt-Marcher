import type { WorldNpc } from '../../../shared/contracts/world-npc.js'

export type NpcCatalogState =
  | Readonly<{ status: 'loading'; token: number }>
  | Readonly<{ status: 'ready' }>
  | Readonly<{ status: 'editing'; npc: WorldNpc | null }>
  | Readonly<{ status: 'saving'; npc: WorldNpc | null; token: number }>
  | Readonly<{
      status: 'conflict'
      npc: WorldNpc | null
      token: number
      message: string
    }>
  | Readonly<{
      status: 'deleting'
      npcId: string
      phase: 'confirming' | 'saving'
      token: number | null
    }>

export type NpcCatalogEvent =
  | Readonly<{ type: 'load-started'; token: number }>
  | Readonly<{ type: 'load-completed'; token: number }>
  | Readonly<{ type: 'edit-started'; npc: WorldNpc | null }>
  | Readonly<{ type: 'edit-canceled' }>
  | Readonly<{ type: 'save-started'; token: number }>
  | Readonly<{ type: 'save-completed'; token: number }>
  | Readonly<{ type: 'save-conflicted'; token: number; message: string }>
  | Readonly<{ type: 'delete-requested'; npcId: string }>
  | Readonly<{ type: 'delete-canceled' }>
  | Readonly<{ type: 'delete-started'; npcId: string; token: number }>
  | Readonly<{ type: 'delete-completed'; token: number }>

export const initialNpcCatalogState: NpcCatalogState = {
  status: 'loading',
  token: 0
}

export function reduceNpcCatalogState(
  state: NpcCatalogState,
  event: NpcCatalogEvent
): NpcCatalogState {
  switch (event.type) {
    case 'load-started':
      return state.status === 'loading'
        ? { status: 'loading', token: event.token }
        : state
    case 'load-completed':
      return state.status === 'loading' && state.token === event.token
        ? { status: 'ready' }
        : state
    case 'edit-started':
      return { status: 'editing', npc: event.npc }
    case 'edit-canceled':
      return { status: 'ready' }
    case 'save-started':
      return state.status === 'editing' || state.status === 'conflict'
        ? { status: 'saving', npc: state.npc, token: event.token }
        : state
    case 'save-completed':
      return state.status === 'saving' && state.token === event.token
        ? { status: 'ready' }
        : state
    case 'save-conflicted':
      return state.status === 'saving' && state.token === event.token
        ? {
            status: 'conflict',
            npc: state.npc,
            token: event.token,
            message: event.message
          }
        : state
    case 'delete-requested':
      return {
        status: 'deleting',
        npcId: event.npcId,
        phase: 'confirming',
        token: null
      }
    case 'delete-canceled':
      return { status: 'ready' }
    case 'delete-started':
      return state.status === 'deleting' && state.npcId === event.npcId
        ? {
            status: 'deleting',
            npcId: event.npcId,
            phase: 'saving',
            token: event.token
          }
        : state
    case 'delete-completed':
      return state.status === 'deleting' && state.token === event.token
        ? { status: 'ready' }
        : state
  }
}
