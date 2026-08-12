import { useCallback, useEffect, useReducer, useRef } from 'react'
import type {
  LootInboxPage,
  LootSceneProjection
} from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useLootScenePort } from './use-loot-ports.js'

const inboxPageSize = 20

export type LootSceneControllerState = Readonly<{
  sceneId: string
  requestEpoch: number
  revision: number
  scene: LootSceneProjection
  inbox: LootInboxPage
  inboxOpen: boolean
  pending: boolean
}>

type ControllerEvent =
  | Readonly<{
      type: 'requested'
      sceneId: string
      locationId: string | null
      epoch: number
    }>
  | Readonly<{
      type: 'loaded'
      sceneId: string
      epoch: number
      scene: LootSceneProjection
      inbox: LootInboxPage | null
    }>
  | Readonly<{
      type: 'page-loaded'
      sceneId: string
      epoch: number
      page: LootInboxPage
      append: boolean
    }>
  | Readonly<{ type: 'failed'; sceneId: string; epoch: number }>

export function createLootSceneControllerState(
  sceneId: string,
  locationId: string | null
): LootSceneControllerState {
  return {
    sceneId,
    requestEpoch: 0,
    revision: 0,
    scene: emptyLootProjection(sceneId, locationId),
    inbox: emptyInboxPage(),
    inboxOpen: false,
    pending: false
  }
}

export function reduceLootSceneController(
  state: LootSceneControllerState,
  event: ControllerEvent
): LootSceneControllerState {
  if (event.type === 'requested')
    return {
      ...(event.sceneId === state.sceneId
        ? state
        : createLootSceneControllerState(event.sceneId, event.locationId)),
      sceneId: event.sceneId,
      requestEpoch: event.epoch,
      pending: true
    }
  if (event.sceneId !== state.sceneId || event.epoch !== state.requestEpoch)
    return state
  if (event.type === 'failed') return { ...state, pending: false }
  if (event.type === 'page-loaded') {
    const knownIds = new Set(
      state.inbox.entries.map(({ treasure }) => treasure.id)
    )
    const entries = event.append
      ? [
          ...state.inbox.entries,
          ...event.page.entries.filter(
            ({ treasure }) => !knownIds.has(treasure.id)
          )
        ]
      : event.page.entries
    return {
      ...state,
      revision: Math.max(state.revision, event.page.revision),
      inbox: { ...event.page, entries },
      inboxOpen: true,
      pending: false
    }
  }
  return {
    ...state,
    revision: Math.max(
      event.scene.revision,
      event.inbox?.revision ?? state.inbox.revision
    ),
    scene: event.scene,
    inbox: event.inbox ?? state.inbox,
    pending: false
  }
}

export function useLootSceneController(input: {
  sceneId: string
  locationId: string | null
  onError: (message: string) => void
}) {
  const { sceneId: inputSceneId, locationId, onError } = input
  const loot = useLootScenePort()
  const epoch = useRef(0)
  const current = useRef<LootSceneControllerState>(
    createLootSceneControllerState(inputSceneId, locationId)
  )
  const mounted = useRef(true)
  const [state, dispatch] = useReducer(
    reduceLootSceneController,
    createLootSceneControllerState(inputSceneId, locationId)
  )

  useEffect(() => {
    current.current = state
  }, [state])

  const refresh = useCallback(async () => {
    const sceneId = inputSceneId
    const requestEpoch = ++epoch.current
    dispatch({
      type: 'requested',
      sceneId,
      locationId,
      epoch: requestEpoch
    })
    try {
      const [scene, inbox] = await Promise.all([
        loot.scene({ sceneId }),
        current.current.inboxOpen
          ? loot.inbox({ cursor: null, limit: inboxPageSize })
          : Promise.resolve(null)
      ])
      if (mounted.current)
        dispatch({
          type: 'loaded',
          sceneId,
          epoch: requestEpoch,
          scene,
          inbox
        })
    } catch (cause) {
      if (mounted.current) {
        dispatch({ type: 'failed', sceneId, epoch: requestEpoch })
        onError(capabilityErrorText(cause))
      }
    }
  }, [inputSceneId, locationId, loot, onError])

  const openInbox = useCallback(async () => {
    const snapshot = current.current
    if (snapshot.inboxOpen || snapshot.pending) return
    const requestEpoch = ++epoch.current
    dispatch({
      type: 'requested',
      sceneId: snapshot.sceneId,
      locationId: snapshot.scene.locationId,
      epoch: requestEpoch
    })
    try {
      const page = await loot.inbox({ cursor: null, limit: inboxPageSize })
      if (mounted.current)
        dispatch({
          type: 'page-loaded',
          sceneId: snapshot.sceneId,
          epoch: requestEpoch,
          page,
          append: false
        })
    } catch (cause) {
      if (mounted.current) {
        dispatch({
          type: 'failed',
          sceneId: snapshot.sceneId,
          epoch: requestEpoch
        })
        onError(capabilityErrorText(cause))
      }
    }
  }, [loot, onError])

  const loadMore = useCallback(async () => {
    const snapshot = current.current
    if (!snapshot.inbox.nextCursor || snapshot.pending) return
    const requestEpoch = ++epoch.current
    dispatch({
      type: 'requested',
      sceneId: snapshot.sceneId,
      locationId: snapshot.scene.locationId,
      epoch: requestEpoch
    })
    try {
      const page = await loot.inbox({
        cursor: snapshot.inbox.nextCursor,
        limit: inboxPageSize
      })
      if (mounted.current)
        dispatch({
          type: 'page-loaded',
          sceneId: snapshot.sceneId,
          epoch: requestEpoch,
          page,
          append: true
        })
    } catch (cause) {
      if (mounted.current) {
        dispatch({
          type: 'failed',
          sceneId: snapshot.sceneId,
          epoch: requestEpoch
        })
        onError(capabilityErrorText(cause))
      }
    }
  }, [loot, onError])

  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => {
      mounted.current = false
    }
  }, [refresh])

  useEffect(
    () =>
      loot.onChanged((notice) => {
        if (notice.revision > current.current.revision) void refresh()
      }),
    [loot, refresh]
  )

  return { ...state, refresh, openInbox, loadMore }
}

function emptyLootProjection(
  sceneId: string,
  locationId: string | null
): LootSceneProjection {
  return {
    revision: 0,
    sceneId,
    locationId,
    locationTreasures: [],
    groupTreasures: []
  }
}

function emptyInboxPage(): LootInboxPage {
  return { revision: 0, entries: [], nextCursor: null }
}
