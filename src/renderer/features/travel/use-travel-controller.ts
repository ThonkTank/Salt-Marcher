import { useCallback, useMemo } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import type { TravelControllerState, TravelScope } from './travel-controller.js'
import type { TravelProviderPort } from './travel-provider-port.js'
import { useTravelViewProjection } from './travel-view-projection.js'
import { useTravelCommands } from './use-travel-commands.js'
import { useTravelQueries } from './use-travel-queries.js'
import { useTravelRemoteReconciliation } from './use-travel-remote-reconciliation.js'

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

/** Thin composition boundary for one active provider-neutral Travel view. */
export function useTravelController<P, S, M, E>(options: {
  port: TravelProviderPort<P, S, M, E> | null
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  active: boolean
}): TravelController<P, S, M, E> {
  const coordinator = useAsyncCommandCoordinator()
  const projection = useTravelViewProjection<P, S, M, E>({
    snapshot: options.snapshot,
    setSnapshot: options.setSnapshot
  })
  const sceneId = options.snapshot.scene.focusedSceneId
  const scope = useMemo<TravelScope | null>(
    () =>
      options.port
        ? {
            sceneId,
            providerKind: options.port.kind,
            providerIdentity: options.port
          }
        : null,
    [options.port, sceneId]
  )
  const queries = useTravelQueries({
    coordinator,
    port: options.port,
    scope,
    projection,
    onError: options.onError
  })
  const commands = useTravelCommands({
    coordinator,
    port: options.port,
    scope,
    projection,
    onError: options.onError
  })
  const { abort, pauseOrResume, positionParty, start, stepMultiplier } =
    commands
  useTravelRemoteReconciliation({
    active: options.active,
    coordinator,
    port: options.port,
    scope,
    projection,
    refreshContext: queries.refreshContext,
    refreshMap: queries.refreshMap
  })

  const activatePosition = useCallback(
    (position: P) => {
      const current = projection.read()
      if (
        !options.port ||
        !current.map ||
        !options.port.isAuthoredPosition(current.map, position)
      ) {
        projection.local({ type: 'selected', position }, 'intent')
        return
      }
      if (current.mode === 'plan')
        projection.local({ type: 'waypoint-added', position }, 'route')
      else if (current.mode === 'position') void positionParty(position)
      else projection.local({ type: 'selected', position }, 'intent')
    },
    [options.port, positionParty, projection]
  )

  return useMemo(
    () => ({
      state: projection.state,
      selectMap: queries.selectMap,
      selectPosition: (position: P) =>
        projection.local({ type: 'selected', position }, 'intent'),
      activatePosition,
      togglePlanning: () =>
        projection.local(
          {
            type: 'mode',
            mode: projection.state.mode === 'plan' ? 'inspect' : 'plan'
          },
          'route'
        ),
      togglePositioning: () =>
        projection.local(
          {
            type: 'mode',
            mode: projection.state.mode === 'position' ? 'inspect' : 'position'
          },
          'route'
        ),
      clearRoute: () => projection.local({ type: 'route-cleared' }, 'route'),
      readViewport: queries.readViewport,
      previewToken: (position: P | null) =>
        projection.local({ type: 'token-preview', position }, 'transient'),
      dropToken: (position: P) => void positionParty(position),
      start,
      pauseOrResume,
      abort,
      stepMultiplier
    }),
    [
      activatePosition,
      abort,
      pauseOrResume,
      positionParty,
      projection,
      queries.readViewport,
      queries.selectMap,
      start,
      stepMultiplier
    ]
  )
}
