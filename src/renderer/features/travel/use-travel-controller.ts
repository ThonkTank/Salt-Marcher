import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import {
  initialTravelControllerState,
  travelControllerReducer,
  travelRequestIsCurrent,
  TravelRequestFactory,
  type TravelControllerEvent,
  type TravelControllerState,
  type TravelRequest,
  type TravelRequestChannel,
  type TravelScope
} from './travel-controller.js'
import type {
  TravelProviderCommand,
  TravelProviderPort
} from './travel-provider-port.js'

const multipliers = [1, 2, 5, 10] as const
const persistedJourneyStatuses = new Set([
  'travelling',
  'paused',
  'blocked',
  'completed',
  'aborted'
])

export type TravelController<P, S, M, E> = Readonly<{
  state: TravelControllerState<P, S, M, E>
  selectMap: (mapId: string) => Promise<void>
  selectPosition: (position: P) => void
  activatePosition: (position: P) => void
  togglePlanning: () => void
  togglePositioning: () => void
  clearRoute: () => void
  readViewport: (center: P) => Promise<void>
  previewToken: (position: P | null) => void
  dropToken: (position: P) => void
  start: () => Promise<void>
  pauseOrResume: () => Promise<void>
  abort: () => Promise<void>
  stepMultiplier: (direction: -1 | 1) => Promise<void>
}>

export function useTravelController<P, S, M, E>(options: {
  port: TravelProviderPort<P, S, M, E> | null
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  active: boolean
}): TravelController<P, S, M, E> {
  const [state, reactDispatch] = useReducer(
    (
      current: TravelControllerState<P, S, M, E>,
      event: TravelControllerEvent<P, S, M, E>
    ) => travelControllerReducer(current, event),
    initialTravelControllerState<P, S, M, E>()
  )
  const stateRef = useRef(state)
  const snapshotRef = useRef(options.snapshot)
  const callbacksRef = useRef({
    onError: options.onError,
    setSnapshot: options.setSnapshot
  })
  const requestFactory = useRef(new TravelRequestFactory())
  const dispatch = useCallback((event: TravelControllerEvent<P, S, M, E>) => {
    stateRef.current = travelControllerReducer(stateRef.current, event)
    reactDispatch(event)
  }, [])
  useEffect(() => {
    snapshotRef.current = options.snapshot
    callbacksRef.current = {
      onError: options.onError,
      setSnapshot: options.setSnapshot
    }
  }, [options.onError, options.setSnapshot, options.snapshot])

  const sceneId = options.snapshot.scene.focusedSceneId
  const scope = useMemo<TravelScope | null>(() => {
    if (!options.port) return null
    return {
      sceneId,
      providerKind: options.port.kind,
      providerIdentity: options.port
    }
  }, [options.port, sceneId])

  const beginRequest = useCallback(
    (currentScope: TravelScope, channel: TravelRequestChannel) => {
      const request = requestFactory.current.next(currentScope, channel)
      dispatch({ type: 'request-started', request })
      return request
    },
    [dispatch]
  )
  const accepts = useCallback(
    (request: TravelRequest) =>
      travelRequestIsCurrent(stateRef.current, request),
    []
  )
  const reportFailure = useCallback(
    (request: TravelRequest, cause: unknown) => {
      if (!accepts(request)) return
      const message = capabilityErrorText(cause)
      callbacksRef.current.onError(message)
      dispatch({ type: 'request-failed', request, message })
    },
    [accepts, dispatch]
  )

  const refreshProjection = useCallback(
    async (forceMap: boolean) => {
      const port = options.port
      if (!options.active || !port || !scope) return
      const request = beginRequest(scope, 'context')
      try {
        const result = await port.read({ sceneId: scope.sceneId })
        if (!accepts(request)) return
        const descriptor = port.describe(result.providerState)
        const previousMapId = stateRef.current.mapId
        const mapId =
          descriptor.currentMapId ??
          descriptor.mapOptions.find((entry) => entry.id === previousMapId)
            ?.id ??
          descriptor.mapOptions[0]?.id ??
          null
        const map = mapId
          ? await port.readMap({
              mapId,
              ...(descriptor.currentPosition === null
                ? {}
                : { center: descriptor.currentPosition }),
              force: forceMap
            })
          : null
        if (!accepts(request)) return
        callbacksRef.current.setSnapshot(result.session)
        dispatch({
          type: 'projection-loaded',
          request,
          providerState: result.providerState,
          mapId,
          map,
          multiplier: descriptor.multiplier
        })
      } catch (cause) {
        reportFailure(request, cause)
      }
    },
    [
      accepts,
      beginRequest,
      dispatch,
      options.active,
      options.port,
      reportFailure,
      scope
    ]
  )

  const refreshMap = useCallback(
    async (port: TravelProviderPort<P, S, M, E>, mapId: string) => {
      if (!scope) return
      const request = beginRequest(scope, 'map')
      try {
        const map = await port.readMap({ mapId, force: true })
        if (accepts(request) && stateRef.current.mapId === mapId)
          dispatch({ type: 'map-refreshed', request, map })
      } catch (cause) {
        reportFailure(request, cause)
      }
    },
    [accepts, beginRequest, dispatch, reportFailure, scope]
  )

  useEffect(() => {
    if (!options.active || !options.port || !scope) {
      dispatch({ type: 'deactivated' })
      return
    }
    dispatch({ type: 'activated', scope })
    void refreshProjection(false)
    return options.port.subscribe((invalidation) => {
      if (
        invalidation.kind === 'context' &&
        invalidation.sceneId !== scope.sceneId
      )
        return
      if (invalidation.kind === 'map') {
        if (invalidation.mapId === stateRef.current.mapId)
          void refreshMap(options.port!, invalidation.mapId)
        return
      }
      void refreshProjection(true)
    })
  }, [
    dispatch,
    options.active,
    options.port,
    refreshMap,
    refreshProjection,
    scope
  ])

  useEffect(() => {
    if (
      !options.active ||
      !options.port ||
      !scope ||
      state.mode !== 'plan' ||
      !state.mapId ||
      state.waypoints.length === 0
    )
      return
    const request = beginRequest(scope, 'evaluation')
    void options.port
      .evaluate({
        sceneId: scope.sceneId,
        mapId: state.mapId,
        waypoints: state.waypoints
      })
      .then((evaluation) => {
        if (accepts(request))
          dispatch({ type: 'evaluated', request, evaluation })
      })
      .catch((cause: unknown) => reportFailure(request, cause))
  }, [
    accepts,
    beginRequest,
    dispatch,
    options.active,
    options.port,
    reportFailure,
    scope,
    state.mapId,
    state.mode,
    state.waypoints
  ])

  const selectMap = useCallback(
    async (mapId: string) => {
      const port = options.port
      if (!port || !scope) return
      const request = beginRequest(scope, 'map')
      try {
        const map = await port.readMap({ mapId })
        if (accepts(request))
          dispatch({ type: 'map-selected', request, mapId, map })
      } catch (cause) {
        reportFailure(request, cause)
      }
    },
    [accepts, beginRequest, dispatch, options.port, reportFailure, scope]
  )

  const applyCommand = useCallback(
    async (command: TravelProviderCommand<P>, clearDraft: boolean) => {
      const port = options.port
      if (!port || !scope || stateRef.current.lifecycle !== 'ready') return
      const request = beginRequest(scope, 'command')
      try {
        const result = await port.execute(command)
        if (!accepts(request)) return
        const descriptor = port.describe(result.providerState)
        callbacksRef.current.setSnapshot(result.session)
        dispatch({
          type: 'command-applied',
          request,
          providerState: result.providerState,
          multiplier: descriptor.multiplier,
          clearDraft
        })
      } catch (cause) {
        reportFailure(request, cause)
      }
    },
    [accepts, beginRequest, dispatch, options.port, reportFailure, scope]
  )

  const positionParty = useCallback(
    async (position: P) => {
      const current = stateRef.current
      const port = options.port
      dispatch({ type: 'selected', position })
      if (
        current.lifecycle !== 'ready' ||
        !port ||
        !current.map ||
        !current.mapId
      )
        return
      if (!port.isAuthoredPosition(current.map, position)) {
        dispatch({ type: 'token-preview', position: null })
        return
      }
      await applyCommand(
        {
          kind: 'position',
          sceneId,
          mapId: current.mapId,
          position,
          expectedSceneRevision: snapshotRef.current.scene.revision
        },
        true
      )
    },
    [applyCommand, dispatch, options.port, sceneId]
  )

  const activatePosition = useCallback(
    (position: P) => {
      const current = stateRef.current
      dispatch({ type: 'selected', position })
      if (
        !options.port ||
        !current.map ||
        !options.port.isAuthoredPosition(current.map, position)
      )
        return
      if (current.mode === 'plan')
        dispatch({ type: 'waypoint-added', position })
      else if (current.mode === 'position') void positionParty(position)
    },
    [dispatch, options.port, positionParty]
  )

  const readViewport = useCallback(
    async (center: P) => {
      const mapId = stateRef.current.mapId
      const port = options.port
      if (!port || !mapId || !scope) return
      const request = beginRequest(scope, 'map')
      try {
        const map = await port.readMap({ mapId, center })
        if (accepts(request) && stateRef.current.mapId === mapId)
          dispatch({ type: 'map-refreshed', request, map })
      } catch (cause) {
        reportFailure(request, cause)
      }
    },
    [accepts, beginRequest, dispatch, options.port, reportFailure, scope]
  )

  const start = useCallback(async () => {
    const current = stateRef.current
    const port = options.port
    if (
      current.lifecycle !== 'ready' ||
      !port ||
      !current.providerState ||
      !current.mapId ||
      !current.evaluation ||
      !port.canStart(current.evaluation)
    )
      return
    await applyCommand(
      {
        kind: 'start',
        sceneId,
        mapId: current.mapId,
        waypoints: current.waypoints,
        multiplier: current.multiplier,
        expectedRevision: port.describe(current.providerState).revision
      },
      true
    )
  }, [applyCommand, options.port, sceneId])

  const pauseOrResume = useCallback(async () => {
    const current = stateRef.current
    const port = options.port
    if (current.lifecycle !== 'ready' || !port || !current.providerState) return
    const descriptor = port.describe(current.providerState)
    const kind =
      descriptor.status === 'travelling'
        ? 'pause'
        : descriptor.status === 'paused' || descriptor.status === 'blocked'
          ? 'resume'
          : null
    if (!kind) return
    await applyCommand(
      { kind, sceneId, expectedRevision: descriptor.revision },
      false
    )
  }, [applyCommand, options.port, sceneId])

  const abort = useCallback(async () => {
    const current = stateRef.current
    const port = options.port
    if (current.lifecycle !== 'ready' || !port || !current.providerState) return
    const descriptor = port.describe(current.providerState)
    if (!['travelling', 'paused', 'blocked'].includes(descriptor.status)) return
    await applyCommand(
      { kind: 'abort', sceneId, expectedRevision: descriptor.revision },
      false
    )
  }, [applyCommand, options.port, sceneId])

  const stepMultiplier = useCallback(
    async (direction: -1 | 1) => {
      const current = stateRef.current
      const index = multipliers.indexOf(current.multiplier)
      const multiplier = multipliers[index + direction]
      if (multiplier === undefined) return
      const port = options.port
      if (!port || !current.providerState) {
        dispatch({ type: 'local-multiplier', multiplier })
        return
      }
      const descriptor = port.describe(current.providerState)
      if (!persistedJourneyStatuses.has(descriptor.status)) {
        dispatch({ type: 'local-multiplier', multiplier })
        return
      }
      if (current.lifecycle !== 'ready') return
      await applyCommand(
        {
          kind: 'set-multiplier',
          sceneId,
          multiplier,
          expectedRevision: descriptor.revision
        },
        false
      )
    },
    [applyCommand, dispatch, options.port, sceneId]
  )

  return useMemo(
    () => ({
      state,
      selectMap,
      selectPosition: (position: P) => dispatch({ type: 'selected', position }),
      activatePosition,
      togglePlanning: () =>
        dispatch({
          type: 'mode',
          mode: state.mode === 'plan' ? 'inspect' : 'plan'
        }),
      togglePositioning: () =>
        dispatch({
          type: 'mode',
          mode: state.mode === 'position' ? 'inspect' : 'position'
        }),
      clearRoute: () => dispatch({ type: 'route-cleared' }),
      readViewport,
      previewToken: (position: P | null) =>
        dispatch({ type: 'token-preview', position }),
      dropToken: (position: P) => void positionParty(position),
      start,
      pauseOrResume,
      abort,
      stepMultiplier
    }),
    [
      abort,
      activatePosition,
      dispatch,
      pauseOrResume,
      positionParty,
      readViewport,
      selectMap,
      start,
      state,
      stepMultiplier
    ]
  )
}
