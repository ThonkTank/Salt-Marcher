import type { TravelMode, TravelMultiplier } from './travel-provider-port.js'

export type TravelLifecycle =
  'inactive' | 'loading' | 'ready' | 'stale' | 'unavailable' | 'error'

export type TravelRequestChannel = 'context' | 'map' | 'evaluation' | 'command'

export type TravelScope = Readonly<{
  sceneId: string
  providerKind: 'hex' | 'dungeon'
  providerIdentity: object
}>

export type TravelRequest = TravelScope &
  Readonly<{
    channel: TravelRequestChannel
    generation: number
  }>

type RequestGenerations = Readonly<Record<TravelRequestChannel, number>>

export type TravelControllerState<P, S, M, E> = Readonly<{
  scope: TravelScope | null
  requests: RequestGenerations
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
  | Readonly<{ type: 'request-started'; request: TravelRequest }>
  | Readonly<{
      type: 'request-failed'
      request: TravelRequest
      message: string
    }>
  | Readonly<{
      type: 'projection-loaded'
      request: TravelRequest
      providerState: S
      mapId: string | null
      map: M | null
      multiplier: TravelMultiplier
    }>
  | Readonly<{
      type: 'provider-updated'
      request: TravelRequest
      providerState: S
      multiplier: TravelMultiplier
    }>
  | Readonly<{
      type: 'map-selected'
      request: TravelRequest
      mapId: string
      map: M
    }>
  | Readonly<{ type: 'map-refreshed'; request: TravelRequest; map: M }>
  | Readonly<{ type: 'selected'; position: P }>
  | Readonly<{ type: 'mode'; mode: TravelMode }>
  | Readonly<{ type: 'waypoint-added'; position: P }>
  | Readonly<{ type: 'route-cleared' }>
  | Readonly<{ type: 'evaluated'; request: TravelRequest; evaluation: E }>
  | Readonly<{ type: 'token-preview'; position: P | null }>
  | Readonly<{ type: 'local-multiplier'; multiplier: TravelMultiplier }>
  | Readonly<{
      type: 'command-applied'
      request: TravelRequest
      providerState: S
      multiplier: TravelMultiplier
      clearDraft: boolean
    }>

const emptyRequests = (): RequestGenerations => ({
  context: 0,
  map: 0,
  evaluation: 0,
  command: 0
})

export function initialTravelControllerState<
  P,
  S,
  M,
  E
>(): TravelControllerState<P, S, M, E> {
  return {
    scope: null,
    requests: emptyRequests(),
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
    case 'activated': {
      if (!sameScope(state.scope, event.scope))
        return {
          ...initialTravelControllerState<P, S, M, E>(),
          scope: event.scope,
          lifecycle: 'loading'
        }
      return {
        ...state,
        lifecycle: state.providerState ? 'stale' : 'loading',
        error: null
      }
    }
    case 'deactivated':
      return {
        ...state,
        lifecycle: 'inactive',
        requests: {
          context: state.requests.context + 1,
          map: state.requests.map + 1,
          evaluation: state.requests.evaluation + 1,
          command: state.requests.command + 1
        }
      }
    case 'request-started':
      if (!sameScope(state.scope, event.request)) return state
      return {
        ...state,
        requests: {
          ...state.requests,
          [event.request.channel]: event.request.generation
        },
        lifecycle:
          event.request.channel === 'context'
            ? state.providerState
              ? 'stale'
              : 'loading'
            : state.lifecycle,
        error: null
      }
    case 'request-failed':
      if (!travelRequestIsCurrent(state, event.request)) return state
      return {
        ...state,
        lifecycle: state.providerState ? 'stale' : 'error',
        error: event.message,
        failureChannel: event.request.channel
      }
    case 'projection-loaded': {
      if (!travelRequestIsCurrent(state, event.request)) return state
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
    case 'provider-updated':
      if (!travelRequestIsCurrent(state, event.request)) return state
      return {
        ...state,
        lifecycle: successfulLifecycle(
          state,
          event.request.channel,
          !!state.map
        ),
        error:
          state.failureChannel === event.request.channel ? null : state.error,
        failureChannel:
          state.failureChannel === event.request.channel
            ? null
            : state.failureChannel,
        providerState: event.providerState,
        multiplier: event.multiplier
      }
    case 'map-selected':
      if (!travelRequestIsCurrent(state, event.request)) return state
      return {
        ...state,
        lifecycle: successfulLifecycle(state, event.request.channel, true),
        error:
          state.failureChannel === event.request.channel ? null : state.error,
        failureChannel:
          state.failureChannel === event.request.channel
            ? null
            : state.failureChannel,
        mapId: event.mapId,
        map: event.map,
        selected: null,
        mode: 'inspect',
        waypoints: [],
        evaluation: null,
        tokenPreview: null
      }
    case 'map-refreshed':
      return travelRequestIsCurrent(state, event.request)
        ? {
            ...state,
            lifecycle: successfulLifecycle(state, event.request.channel, true),
            error:
              state.failureChannel === event.request.channel
                ? null
                : state.error,
            failureChannel:
              state.failureChannel === event.request.channel
                ? null
                : state.failureChannel,
            map: event.map
          }
        : state
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
      return travelRequestIsCurrent(state, event.request)
        ? {
            ...state,
            lifecycle: successfulLifecycle(state, event.request.channel, true),
            error:
              state.failureChannel === event.request.channel
                ? null
                : state.error,
            failureChannel:
              state.failureChannel === event.request.channel
                ? null
                : state.failureChannel,
            evaluation: event.evaluation
          }
        : state
    case 'token-preview':
      return { ...state, tokenPreview: event.position }
    case 'local-multiplier':
      return { ...state, multiplier: event.multiplier }
    case 'command-applied':
      if (!travelRequestIsCurrent(state, event.request)) return state
      return {
        ...state,
        lifecycle: 'ready',
        error: null,
        failureChannel: null,
        providerState: event.providerState,
        multiplier: event.multiplier,
        mode: event.clearDraft ? 'inspect' : state.mode,
        waypoints: event.clearDraft ? [] : state.waypoints,
        evaluation: event.clearDraft ? null : state.evaluation,
        tokenPreview: null
      }
  }
}

export function travelRequestIsCurrent<P, S, M, E>(
  state: TravelControllerState<P, S, M, E>,
  request: TravelRequest
): boolean {
  return (
    sameScope(state.scope, request) &&
    state.requests[request.channel] === request.generation
  )
}

function sameScope(left: TravelScope | null, right: TravelScope): boolean {
  return (
    left?.sceneId === right.sceneId &&
    left.providerKind === right.providerKind &&
    left.providerIdentity === right.providerIdentity
  )
}

export class TravelRequestFactory {
  private generation = 0

  next(scope: TravelScope, channel: TravelRequestChannel): TravelRequest {
    this.generation += 1
    return { ...scope, channel, generation: this.generation }
  }
}

function successfulLifecycle<P, S, M, E>(
  state: TravelControllerState<P, S, M, E>,
  channel: TravelRequestChannel,
  available: boolean
): TravelLifecycle {
  if (
    state.lifecycle === 'stale' &&
    state.failureChannel !== null &&
    state.failureChannel !== channel
  )
    return 'stale'
  return available ? 'ready' : 'unavailable'
}
