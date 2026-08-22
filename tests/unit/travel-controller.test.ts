import { describe, expect, it } from 'vitest'
import {
  initialTravelControllerState,
  travelControllerReducer,
  type TravelControllerState,
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

function readyState(): State {
  let state = travelControllerReducer(
    initialTravelControllerState<
      Position,
      ProviderState,
      MapProjection,
      Evaluation
    >(),
    { type: 'activated', scope }
  )
  state = travelControllerReducer(state, {
    type: 'request-started',
    channel: 'context'
  })
  return travelControllerReducer(state, {
    type: 'projection-loaded',
    providerState: { revision: 1, status: 'ready' },
    mapId: 'coast',
    map: { id: 'coast' },
    multiplier: 1
  })
}

describe('travel controller view state', () => {
  it('keeps provider truth separate from transient route and token state', () => {
    let state = readyState()
    state = travelControllerReducer(state, { type: 'mode', mode: 'plan' })
    state = travelControllerReducer(state, {
      type: 'waypoint-added',
      position: { q: 1, r: 0 }
    })
    state = travelControllerReducer(state, {
      type: 'token-preview',
      position: { q: 2, r: 0 }
    })
    state = travelControllerReducer(state, {
      type: 'provider-reconciled',
      providerState: { revision: 2, status: 'travelling' },
      multiplier: 2,
      preserveLocal: true
    })

    expect(state).toMatchObject({
      lifecycle: 'ready',
      providerState: { revision: 2 },
      mapId: 'coast',
      mode: 'plan',
      waypoints: [{ q: 1, r: 0 }],
      tokenPreview: { q: 2, r: 0 },
      multiplier: 1
    })
  })

  it('resets every draft on scope changes and only map draft on map changes', () => {
    let state = readyState()
    state = travelControllerReducer(state, { type: 'mode', mode: 'plan' })
    state = travelControllerReducer(state, {
      type: 'waypoint-added',
      position: { q: 1, r: 0 }
    })
    state = travelControllerReducer(state, {
      type: 'map-selected',
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

  it('retains a Scene draft while inactive and requires refresh before ready', () => {
    let state = readyState()
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
    let state = travelControllerReducer(
      initialTravelControllerState<
        Position,
        ProviderState,
        MapProjection,
        Evaluation
      >(),
      { type: 'activated', scope }
    )
    state = travelControllerReducer(state, {
      type: 'request-failed',
      channel: 'context',
      message: 'offline'
    })
    expect(state).toMatchObject({ lifecycle: 'error', error: 'offline' })

    state = travelControllerReducer(state, { type: 'activated', scope })
    state = travelControllerReducer(state, {
      type: 'projection-loaded',
      providerState: { revision: 0, status: 'unpositioned' },
      mapId: null,
      map: null,
      multiplier: 1
    })
    expect(state.lifecycle).toBe('unavailable')

    state = readyState()
    state = travelControllerReducer(state, {
      type: 'request-failed',
      channel: 'map',
      message: 'refresh failed'
    })
    expect(state).toMatchObject({
      lifecycle: 'stale',
      map: { id: 'coast' },
      providerState: { revision: 1 },
      error: 'refresh failed'
    })
  })

  it('keeps a command domain error until that command channel succeeds', () => {
    let state = readyState()
    state = travelControllerReducer(state, {
      type: 'request-failed',
      channel: 'command',
      message: 'revision conflict'
    })
    state = travelControllerReducer(state, {
      type: 'request-started',
      channel: 'command'
    })
    expect(state.error).toBe('revision conflict')
    state = travelControllerReducer(state, {
      type: 'command-applied',
      providerState: { revision: 2, status: 'travelling' },
      multiplier: 1,
      clearDraft: false,
      preserveLocal: false
    })
    expect(state).toMatchObject({
      lifecycle: 'ready',
      error: null,
      failureChannel: null,
      providerState: { revision: 2 }
    })
  })
})
