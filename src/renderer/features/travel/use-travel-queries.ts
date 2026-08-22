import { useCallback, useEffect, useRef } from 'react'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { sameTravelScope, type TravelScope } from './travel-controller.js'
import type { TravelProviderPort } from './travel-provider-port.js'
import type { TravelViewProjection } from './travel-view-projection.js'

/** Owns latest-only context, map and route-evaluation reads. */
export function useTravelQueries<P, S, M, E>(options: {
  coordinator: AsyncCommandCoordinator
  port: TravelProviderPort<P, S, M, E> | null
  scope: TravelScope | null
  projection: TravelViewProjection<P, S, M, E>
  onError: (message: string) => void
}) {
  const { coordinator, onError, port, projection, scope } = options
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const {
    acceptContext,
    acceptEvaluation,
    acceptMap,
    beginMapIntent,
    capture,
    failed,
    read,
    started
  } = projection

  const reportFailure = useCallback(
    (
      target: NonNullable<ReturnType<typeof capture>>,
      authority: 'intent' | 'map' | 'route',
      channel: 'context' | 'map' | 'evaluation',
      cause: unknown
    ) => {
      const message = capabilityErrorText(cause)
      if (failed(target, authority, channel, message))
        onErrorRef.current(message)
    },
    [failed]
  )

  const refreshContext = useCallback(
    async (forceMap: boolean): Promise<void> => {
      if (!port || !scope) return
      const target = capture()
      if (!target || !sameTravelScope(target.scope, scope)) return
      started('context')
      const outcome = await coordinator.run({
        scope: 'travel.context-query',
        entityKey: travelEntityKey(scope),
        mode: 'latest-only',
        execute: async ({ signal }) => {
          const result = await port.read({ sceneId: scope.sceneId })
          signal.throwIfAborted()
          const descriptor = port.describe(result.providerState)
          const mapId =
            descriptor.currentMapId ??
            descriptor.mapOptions.find((entry) => entry.id === target.mapId)
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
          signal.throwIfAborted()
          return { result, descriptor, mapId, map }
        },
        accept: ({ result, descriptor, mapId, map }) =>
          acceptContext({
            target,
            result,
            descriptor,
            mapId,
            map,
            describe: port.describe
          })
      })
      if (outcome.status === 'failure')
        reportFailure(target, 'intent', 'context', outcome.cause)
    },
    [acceptContext, capture, coordinator, port, reportFailure, scope, started]
  )

  const runMapRead = useCallback(
    async (input: {
      mapId: string
      center?: P
      force?: boolean
      selected: boolean
    }): Promise<void> => {
      if (!port || !scope) return
      if (input.selected) {
        const current = capture()
        if (!current || !sameTravelScope(current.scope, scope)) return
        beginMapIntent()
      }
      const target = capture(input.mapId)
      if (!target || !sameTravelScope(target.scope, scope)) return
      started('map')
      const outcome = await coordinator.run({
        scope: 'travel.map-query',
        entityKey: travelEntityKey(scope),
        mode: 'latest-only',
        execute: async ({ signal }) => {
          const map = await port.readMap({
            mapId: input.mapId,
            ...(input.center === undefined ? {} : { center: input.center }),
            ...(input.force === undefined ? {} : { force: input.force })
          })
          signal.throwIfAborted()
          return map
        },
        accept: (map) => acceptMap(target, map, input.selected)
      })
      if (outcome.status === 'failure')
        reportFailure(
          target,
          input.selected ? 'intent' : 'map',
          'map',
          outcome.cause
        )
    },
    [
      acceptMap,
      beginMapIntent,
      capture,
      coordinator,
      port,
      reportFailure,
      scope,
      started
    ]
  )

  const selectMap = useCallback(
    (mapId: string) => runMapRead({ mapId, selected: true }),
    [runMapRead]
  )

  const readViewport = useCallback(
    (center: P) => {
      const mapId = read().mapId
      return mapId
        ? runMapRead({ mapId, center, selected: false })
        : Promise.resolve()
    },
    [read, runMapRead]
  )

  const refreshMap = useCallback(
    (mapId: string) => runMapRead({ mapId, force: true, selected: false }),
    [runMapRead]
  )

  const state = projection.state
  useEffect(() => {
    if (
      !port ||
      !scope ||
      state.lifecycle !== 'ready' ||
      !sameTravelScope(state.scope, scope) ||
      state.mode !== 'plan' ||
      !state.mapId ||
      state.waypoints.length === 0
    )
      return
    const abort = new AbortController()
    const target = capture()
    if (!target || !sameTravelScope(target.scope, scope)) return
    started('evaluation')
    void coordinator
      .run({
        scope: 'travel.evaluation-query',
        entityKey: travelEntityKey(scope),
        mode: 'latest-only',
        signal: abort.signal,
        execute: async ({ signal }) => {
          const evaluation = await port.evaluate({
            sceneId: scope.sceneId,
            mapId: state.mapId!,
            waypoints: state.waypoints
          })
          signal.throwIfAborted()
          return evaluation
        },
        accept: (evaluation) => acceptEvaluation(target, evaluation)
      })
      .then((outcome) => {
        if (outcome.status === 'failure')
          reportFailure(target, 'route', 'evaluation', outcome.cause)
      })
    return () => abort.abort('travel-route-changed')
  }, [
    acceptEvaluation,
    capture,
    coordinator,
    port,
    reportFailure,
    scope,
    started,
    state.mapId,
    state.lifecycle,
    state.mode,
    state.scope,
    state.waypoints
  ])

  return { refreshContext, refreshMap, selectMap, readViewport }
}

export function travelEntityKey(scope: TravelScope): string {
  return JSON.stringify([scope.providerKind, scope.sceneId])
}
