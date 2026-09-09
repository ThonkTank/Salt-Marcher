import {
  useTravelRouteDraft,
  type TravelRouteDraft
} from './use-travel-route-draft.js'
import { useDraftTransition } from '../../shell/use-draft-transition.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { ReactNode } from 'react'
import { useMaintenanceEditingBlocked } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
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
  busy: boolean
  routeDirty: boolean
  saveRoute: () => Promise<void>
  notice?: ReactNode
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
  commandBusy?: boolean
  routeDraft?: TravelRouteDraft<P>
  commandsBlocked?: () => boolean
  presentation?: { mapId: string | null; selected: P | null }
}): TravelController<P, S, M, E> {
  const { commandsBlocked, routeDraft, onError } = options
  const maintenance = useMaintenanceEditingBlocked()
  const blocked = useCallback(
    () =>
      maintenanceDraftCoordinator.isLocked() ||
      routeDraft?.snapshot().busy === true ||
      commandsBlocked?.() === true,
    [commandsBlocked, routeDraft]
  )
  const coordinator = useAsyncCommandCoordinator()
  const projection = useTravelViewProjection<P, S, M, E>({
    snapshot: options.snapshot,
    setSnapshot: options.setSnapshot,
    ...(options.presentation ? { presentation: options.presentation } : {})
  })
  const draftState = useTravelRouteDraft(routeDraft, options.port, projection)
  const sceneId = options.snapshot.scene.focusedSceneId
  const transition = useDraftTransition(sceneId)
  const requestTransition = transition.request
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
    preferSelectedMap: !!options.presentation,
    coordinator,
    port: options.port,
    scope,
    projection,
    onError: options.onError
  })
  const selectMap = queries.selectMap
  const commands = useTravelCommands({
    blocked,
    routeDraft,
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
      if (blocked()) return
      const current = projection.read()
      if (
        !options.port ||
        !current.map ||
        !options.port.isAuthoredPosition(current.map, position)
      ) {
        projection.local({ type: 'selected', position }, 'intent')
        return
      }
      if (current.mode === 'plan') {
        if (
          routeDraft &&
          (!current.mapId ||
            !routeDraft.edit({
              mapId: current.mapId,
              waypoints: [...current.waypoints, position],
              multiplier: current.multiplier
            }))
        )
          return
        projection.local({ type: 'waypoint-added', position }, 'route')
      } else if (current.mode === 'position') void positionParty(position)
      else projection.local({ type: 'selected', position }, 'intent')
    },
    [blocked, options.port, positionParty, projection, routeDraft]
  )

  return useMemo(
    () => ({
      busy: maintenance || draftState.busy || options.commandBusy === true,
      routeDirty: draftState.dirty,
      notice: transition.dialog,
      saveRoute: async () => {
        if (blocked() || !routeDraft) return
        try {
          await routeDraft.save()
        } catch (cause) {
          onError(capabilityErrorText(cause))
        }
      },
      state: projection.state,
      selectMap: async (mapId: string) => {
        if (blocked()) return
        if (routeDraft?.isDirty() && projection.read().mapId !== mapId)
          requestTransition(() => {
            if (!blocked()) void selectMap(mapId)
          })
        else await selectMap(mapId)
      },
      selectPosition: (position: P) =>
        !blocked() &&
        projection.local({ type: 'selected', position }, 'intent'),
      activatePosition,
      togglePlanning: () =>
        !blocked() &&
        projection.local(
          {
            type: 'mode',
            mode: projection.state.mode === 'plan' ? 'inspect' : 'plan'
          },
          'route'
        ),
      togglePositioning: () =>
        !blocked() &&
        projection.local(
          {
            type: 'mode',
            mode: projection.state.mode === 'position' ? 'inspect' : 'position'
          },
          'route'
        ),
      clearRoute: () => {
        if (blocked() || (routeDraft && !routeDraft.edit(null))) return
        projection.local({ type: 'route-cleared' }, 'route')
      },
      readViewport: queries.readViewport,
      previewToken: (position: P | null) =>
        !blocked() &&
        projection.local({ type: 'token-preview', position }, 'transient'),
      dropToken: (position: P) => void positionParty(position),
      start,
      pauseOrResume,
      abort,
      stepMultiplier
    }),
    [
      activatePosition,
      routeDraft,
      draftState.busy,
      draftState.dirty,
      transition.dialog,
      requestTransition,
      onError,
      blocked,
      maintenance,
      options.commandBusy,
      abort,
      pauseOrResume,
      positionParty,
      projection,
      queries.readViewport,
      selectMap,
      start,
      stepMultiplier
    ]
  )
}
