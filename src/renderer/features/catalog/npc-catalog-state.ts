import type { WorldNpc } from '../../../shared/contracts/world-npc.js'

export type NpcCatalogState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready' }>
  | Readonly<{ status: 'editing'; npc: WorldNpc | null }>
  | Readonly<{ status: 'saving'; npc: WorldNpc | null }>
  | Readonly<{ status: 'conflict'; npc: WorldNpc | null; message: string }>
  | Readonly<{
      status: 'deleting'
      npcId: string
      phase: 'confirming' | 'saving'
    }>

export type NpcCatalogEvent =
  | Readonly<{ type: 'load-started' }>
  | Readonly<{ type: 'load-completed' }>
  | Readonly<{ type: 'edit-started'; npc: WorldNpc | null }>
  | Readonly<{ type: 'edit-canceled' }>
  | Readonly<{ type: 'save-started' }>
  | Readonly<{ type: 'save-completed' }>
  | Readonly<{ type: 'save-conflicted'; message: string }>
  | Readonly<{ type: 'delete-requested'; npcId: string }>
  | Readonly<{ type: 'delete-canceled' }>
  | Readonly<{ type: 'delete-started'; npcId: string }>
  | Readonly<{ type: 'delete-completed' }>

export const initialNpcCatalogState: NpcCatalogState = { status: 'loading' }

export function reduceNpcCatalogState(
  state: NpcCatalogState,
  event: NpcCatalogEvent
): NpcCatalogState {
  switch (event.type) {
    case 'load-started':
      return state
    case 'load-completed':
      return state.status === 'loading' ? { status: 'ready' } : state
    case 'edit-started':
      return { status: 'editing', npc: event.npc }
    case 'edit-canceled':
      return { status: 'ready' }
    case 'save-started':
      return state.status === 'editing' || state.status === 'conflict'
        ? { status: 'saving', npc: state.npc }
        : state
    case 'save-completed':
      return state.status === 'saving' ? { status: 'ready' } : state
    case 'save-conflicted':
      return state.status === 'saving'
        ? { status: 'conflict', npc: state.npc, message: event.message }
        : state
    case 'delete-requested':
      return {
        status: 'deleting',
        npcId: event.npcId,
        phase: 'confirming'
      }
    case 'delete-canceled':
      return { status: 'ready' }
    case 'delete-started':
      return state.status === 'deleting' && state.npcId === event.npcId
        ? { status: 'deleting', npcId: event.npcId, phase: 'saving' }
        : state
    case 'delete-completed':
      return state.status === 'deleting' ? { status: 'ready' } : state
  }
}

export function editableNpc(state: NpcCatalogState) {
  return state.status === 'editing' ||
    state.status === 'saving' ||
    state.status === 'conflict'
    ? state.npc
    : undefined
}
