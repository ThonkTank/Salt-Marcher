import { describe, expect, it } from 'vitest'
import {
  initialTravelControllerState,
  travelControllerReducer,
  TravelRequestFactory,
  type TravelControllerState,
  type TravelRequest,
  type TravelScope
} from '../../src/renderer/features/travel/travel-controller.js'

type Position = { q: number; r: number }
type ProviderState = { revision: number; status: string }
type MapProjection = { id: string }
type Evaluation = { status: string }
type State = TravelControllerState<
  Position,
  ProviderState,
  MapProjection,
  Evaluation
>

const scope: TravelScope = {
  sceneId: 'scene-a',
  providerKind: 'hex',
  providerIdentity: {}
}

function begin(
  state: State,
  factory: TravelRequestFactory,
  channel: TravelRequest['channel']
) {
  const request = factory.next(scope, channel)
  return {
    request,
    state: travelControllerReducer(state, { type: 'request-started', request })
  }
}

function readyState() {
  const factory = new TravelRequestFactory()
  let state = travelControllerReducer(
    initialTravelControllerState<
      Position,
      ProviderState,
      MapProjection,
      Evaluation
    >(),
    { type: 'activated', scope }
  )
  const pending = begin(state, factory, 'context')
  state = travelControllerReducer(pending.state, {
    type: 'projection-loaded',
    request: pending.request,
    providerState: { revision: 1, status: 'ready' },
    mapId: 'coast',
    map: { id: 'coast' },
    multiplier: 1
  })
  return { state, factory }
}

describe('travel controller state', () => {
  it('keeps provider truth separate from transient route and token state', () => {
    const ready = readyState()
    let state = ready.state
    const factory = ready.factory
    state = travelControllerReducer(state, { type: 'mode', mode: 'plan' })
    state = travelControllerReducer(state, {
      type: 'waypoint-added',
      position: { q: 1, r: 0 }
    })
    state = travelControllerReducer(state, {
      type: 'token-preview',
      position: { q: 2, r: 0 }
    })
    const pending = begin(state, factory, 'context')
    state = travelControllerReducer(pending.state, {
      type: 'provider-updated',
      request: pending.request,
      providerState: { revision: 2, status: 'travelling' },
      multiplier: 2
    })

    expect(state).toMatchObject({
      lifecycle: 'ready',
      providerState: { revision: 2 },
      mapId: 'coast',
      mode: 'plan',
      waypoints: [{ q: 1, r: 0 }],
      tokenPreview: { q: 2, r: 0 },
      multiplier: 2
    })
  })

  it('resets every draft on scene/provider changes and only map draft on map changes', () => {
    const ready = readyState()
    let state = ready.state
    const factory = ready.factory
    state = travelControllerReducer(state, { type: 'mode', mode: 'plan' })
    state = travelControllerReducer(state, {
      type: 'waypoint-added',
      position: { q: 1, r: 0 }
    })
    const mapPending = begin(state, factory, 'map')
    state = travelControllerReducer(mapPending.state, {
      type: 'map-selected',
      request: mapPending.request,
      mapId: 'islands',
      map: { id: 'islands' }
    })
    expect(state).toMatchObject({
      lifecycle: 'ready',
      mapId: 'islands',
      mode: 'inspect',
      waypoints: [],
      evaluation: null,
      selected: null
    })

    state = travelControllerReducer(state, {
      type: 'activated',
      scope: { ...scope, sceneId: 'scene-b' }
    })
    expect(state).toMatchObject({
      lifecycle: 'loading',
      providerState: null,
      mapId: null,
      map: null,
      waypoints: [],
      tokenPreview: null,
      multiplier: 1
    })
  })

  it('retains a scene draft while inactive and requires refresh before ready', () => {
    let { state } = readyState()
    state = travelControllerReducer(state, { type: 'mode', mode: 'plan' })
    state = travelControllerReducer(state, {
      type: 'waypoint-added',
      position: { q: 1, r: 0 }
    })
    state = travelControllerReducer(state, { type: 'deactivated' })
    expect(state).toMatchObject({
      lifecycle: 'inactive',
      waypoints: [{ q: 1, r: 0 }]
    })
    state = travelControllerReducer(state, { type: 'activated', scope })
    expect(state).toMatchObject({
      lifecycle: 'stale',
      waypoints: [{ q: 1, r: 0 }]
    })
  })

  it('covers unavailable, initial error, and stale projection lifecycles', () => {
    const factory = new TravelRequestFactory()
    let state = travelControllerReducer(
      initialTravelControllerState<
        Position,
        ProviderState,
        MapProjection,
        Evaluation
      >(),
      { type: 'activated', scope }
    )
    let pending = begin(state, factory, 'context')
    state = travelControllerReducer(pending.state, {
      type: 'request-failed',
      request: pending.request,
      message: 'offline'
    })
    expect(state).toMatchObject({ lifecycle: 'error', error: 'offline' })

    state = travelControllerReducer(state, { type: 'activated', scope })
    pending = begin(state, factory, 'context')
    state = travelControllerReducer(pending.state, {
      type: 'projection-loaded',
      request: pending.request,
      providerState: { revision: 0, status: 'unpositioned' },
      mapId: null,
      map: null,
      multiplier: 1
    })
    expect(state.lifecycle).toBe('unavailable')

    ;({ state } = readyState())
    pending = begin(state, factory, 'map')
    state = travelControllerReducer(pending.state, {
      type: 'request-failed',
      request: pending.request,
      message: 'refresh failed'
    })
    expect(state).toMatchObject({
      lifecycle: 'stale',
      map: { id: 'coast' },
      providerState: { revision: 1 },
      error: 'refresh failed'
    })
  })

  it('discards stale results by scene, provider and request generation in the reducer', () => {
    const ready = readyState()
    let state = ready.state
    const factory = ready.factory
    const older = begin(state, factory, 'map')
    const newer = begin(older.state, factory, 'map')
    state = travelControllerReducer(newer.state, {
      type: 'map-refreshed',
      request: older.request,
      map: { id: 'old' }
    })
    expect(state.map).toEqual({ id: 'coast' })
    state = travelControllerReducer(state, {
      type: 'map-refreshed',
      request: newer.request,
      map: { id: 'new' }
    })
    expect(state.map).toEqual({ id: 'new' })

    const wrongScope = { ...newer.request, providerIdentity: {} }
    state = travelControllerReducer(state, {
      type: 'map-refreshed',
      request: wrongScope,
      map: { id: 'wrong-provider' }
    })
    expect(state.map).toEqual({ id: 'new' })
  })
})
