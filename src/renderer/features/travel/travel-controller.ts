import type { TravelMode, TravelMultiplier } from './travel-provider-port.js'

export type TravelLifecycle =
  'inactive' | 'loading' | 'ready' | 'stale' | 'unavailable' | 'error'

export type TravelRequestChannel = 'context' | 'map' | 'evaluation' | 'command'

export type TravelScope = Readonly<{
  sceneId: string
  providerKind: 'hex' | 'dungeon'
  providerIdentity: object
}>

export type TravelControllerState<P, S, M, E> = Readonly<{
  scope: TravelScope | null
  lifecycle: TravelLifecycle
  error: string | null
  failureChannel: TravelRequestChannel | null
  providerState: S | null
  mapId: string | null
  map: M | null
  selected: P | null
  mode: TravelMode
  waypoints: readonly P[]
  evaluation: E | null
  multiplier: TravelMultiplier
  tokenPreview: P | null
}>

export type TravelControllerEvent<P, S, M, E> =
  | Readonly<{ type: 'activated'; scope: TravelScope }>
  | Readonly<{ type: 'deactivated' }>
  | Readonly<{ type: 'request-started'; channel: TravelRequestChannel }>
  | Readonly<{
      type: 'request-failed'
      channel: TravelRequestChannel
      message: string
    }>
  | Readonly<{
      type: 'projection-loaded'
      providerState: S
      mapId: string | null
      map: M | null
      multiplier: TravelMultiplier
    }>
  | Readonly<{
      type: 'provider-reconciled'
      providerState: S
      multiplier: TravelMultiplier
      preserveLocal: boolean
    }>
  | Readonly<{ type: 'map-selected'; mapId: string; map: M }>
  | Readonly<{ type: 'map-refreshed'; map: M }>
  | Readonly<{ type: 'selected'; position: P }>
  | Readonly<{ type: 'mode'; mode: TravelMode }>
  | Readonly<{ type: 'waypoint-added'; position: P }>
  | Readonly<{ type: 'route-cleared' }>
  | Readonly<{ type: 'evaluated'; evaluation: E }>
  | Readonly<{ type: 'token-preview'; position: P | null }>
  | Readonly<{ type: 'local-multiplier'; multiplier: TravelMultiplier }>
  | Readonly<{
      type: 'command-applied'
      providerState: S
      multiplier: TravelMultiplier
      clearDraft: boolean
      preserveLocal: boolean
    }>

export function initialTravelControllerState<
  P,
  S,
  M,
  E
>(): TravelControllerState<P, S, M, E> {
  return {
    scope: null,
    lifecycle: 'inactive',
    error: null,
    failureChannel: null,
    providerState: null,
    mapId: null,
    map: null,
    selected: null,
    mode: 'inspect',
    waypoints: [],
    evaluation: null,
    multiplier: 1,
    tokenPreview: null
  }
}

export function travelControllerReducer<P, S, M, E>(
  state: TravelControllerState<P, S, M, E>,
  event: TravelControllerEvent<P, S, M, E>
): TravelControllerState<P, S, M, E> {
  switch (event.type) {
    case 'activated':
      return sameTravelScope(state.scope, event.scope)
        ? {
            ...state,
            lifecycle: state.providerState ? 'stale' : 'loading',
            error: null
          }
        : {
            ...initialTravelControllerState<P, S, M, E>(),
            scope: event.scope,
            lifecycle: 'loading'
          }
    case 'deactivated':
      return { ...state, lifecycle: 'inactive' }
    case 'request-started':
      return {
        ...state,
        lifecycle:
          event.channel === 'context'
            ? state.providerState
              ? 'stale'
              : 'loading'
            : state.lifecycle,
        error: event.channel === 'command' ? state.error : null
      }
    case 'request-failed':
      return {
        ...state,
        lifecycle: state.providerState ? 'stale' : 'error',
        error: event.message,
        failureChannel: event.channel
      }
    case 'projection-loaded': {
      const mapChanged = state.mapId !== event.mapId
      return {
        ...state,
        lifecycle: event.map ? 'ready' : 'unavailable',
        error: null,
        failureChannel: null,
        providerState: event.providerState,
        mapId: event.mapId,
        map: event.map,
        multiplier: event.multiplier,
        selected: mapChanged ? null : state.selected,
        mode: mapChanged ? 'inspect' : state.mode,
        waypoints: mapChanged ? [] : state.waypoints,
        evaluation: mapChanged ? null : state.evaluation,
        tokenPreview: mapChanged ? null : state.tokenPreview
      }
    }
    case 'provider-reconciled':
      return successfulRequest(
        state,
        'context',
        {
          providerState: event.providerState,
          multiplier: event.preserveLocal ? state.multiplier : event.multiplier
        },
        state.map !== null
      )
    case 'map-selected':
      return successfulRequest(state, 'map', {
        mapId: event.mapId,
        map: event.map,
        selected: null,
        mode: 'inspect',
        waypoints: [],
        evaluation: null,
        tokenPreview: null
      })
    case 'map-refreshed':
      return successfulRequest(state, 'map', { map: event.map })
    case 'selected':
      return { ...state, selected: event.position }
    case 'mode':
      return {
        ...state,
        mode: event.mode,
        waypoints: event.mode === 'plan' ? [] : state.waypoints,
        evaluation: event.mode === 'plan' ? null : state.evaluation,
        tokenPreview: event.mode === 'position' ? state.tokenPreview : null
      }
    case 'waypoint-added':
      return {
        ...state,
        selected: event.position,
        waypoints: [...state.waypoints, event.position],
        evaluation: null
      }
    case 'route-cleared':
      return { ...state, waypoints: [], evaluation: null }
    case 'evaluated':
      return successfulRequest(state, 'evaluation', {
        evaluation: event.evaluation
      })
    case 'token-preview':
      return { ...state, tokenPreview: event.position }
    case 'local-multiplier':
      return { ...state, multiplier: event.multiplier }
    case 'command-applied':
      return {
        ...successfulRequest(state, 'command', {
          providerState: event.providerState,
          multiplier: event.preserveLocal ? state.multiplier : event.multiplier
        }),
        mode: event.clearDraft && !event.preserveLocal ? 'inspect' : state.mode,
        waypoints:
          event.clearDraft && !event.preserveLocal ? [] : state.waypoints,
        evaluation:
          event.clearDraft && !event.preserveLocal ? null : state.evaluation,
        tokenPreview: event.preserveLocal ? state.tokenPreview : null
      }
  }
}

export function sameTravelScope(
  left: TravelScope | null,
  right: TravelScope | null
): boolean {
  return (
    left?.sceneId === right?.sceneId &&
    left?.providerKind === right?.providerKind &&
    left?.providerIdentity === right?.providerIdentity
  )
}

function successfulRequest<P, S, M, E>(
  state: TravelControllerState<P, S, M, E>,
  channel: TravelRequestChannel,
  patch: Partial<TravelControllerState<P, S, M, E>>,
  available = true
): TravelControllerState<P, S, M, E> {
  const retainsOtherFailure =
    state.lifecycle === 'stale' &&
    state.failureChannel !== null &&
    state.failureChannel !== channel
  return {
    ...state,
    ...patch,
    lifecycle: retainsOtherFailure
      ? 'stale'
      : available
        ? 'ready'
        : 'unavailable',
    error: state.failureChannel === channel ? null : state.error,
    failureChannel:
      state.failureChannel === channel ? null : state.failureChannel
  }
}
