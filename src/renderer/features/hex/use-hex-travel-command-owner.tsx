import { HexRoutePlanDraft } from './hex-route-plan-draft.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore
} from 'react'
import type {
  HexTravelCommand,
  HexTravelCommandState
} from '../../../shared/contracts/hex-travel-command.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import {
  draftConcern,
  maintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import { HexTravelCommandController } from './hex-travel-command-controller.js'
import type { HexTravelCommandPort } from './use-hex-travel-command-port.js'

/** Owns pending commands independently of the visible Travel windows. */
export function useHexTravelCommandOwner(
  port: HexTravelCommandPort,
  completed: (current: HexTravelCommandState) => void,
  sceneId: string
) {
  const controller = useMemo(() => new HexTravelCommandController(port), [port])
  const routeDraft = useMemo(
    () => new HexRoutePlanDraft(sceneId, port, controller),
    [sceneId, port, controller]
  )
  const routeState = useSyncExternalStore(
    routeDraft.subscribe,
    routeDraft.snapshot
  )
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot)
  const result = useRef<HexTravelCommandState | null>(null)
  const observer = useRef(completed)
  useLayoutEffect(() => {
    observer.current = completed
  })
  useLayoutEffect(() => {
    controller.attach((_receipt, current) => {
      result.current = current
      routeDraft.observe(current.routePlan)
      observer.current(current)
    })
    return controller.detach
  }, [controller, routeDraft])
  useLayoutEffect(() => {
    routeDraft.attach()
    return routeDraft.detach
  }, [routeDraft])
  const ownerId = useId()
  const maintenance = useMaintenanceDraft(
    {
      label: message('travel.commands'),
      concerns: [
        draftConcern.travelCommand(sceneId),
        draftConcern.scene(sceneId)
      ],
      isDirty: controller.held,
      settleBackgroundWrites: async () => {
        await controller.settle()
      },
      save: controller.save,
      discard: controller.discard
    },
    ownerId
  )
  useMaintenanceDraft({
    label: message('travel.routeDraft'),
    concerns: [draftConcern.travelRoute(sceneId), draftConcern.scene(sceneId)],
    get dependsOn() {
      return routeDraft.isDirty() ? [ownerId] : []
    },
    isDirty: routeDraft.isDirty,
    save: routeDraft.save,
    discard: routeDraft.discard
  })
  const blocked = useCallback(
    () =>
      maintenanceDraftCoordinator.isLocked() ||
      controller.held() ||
      routeDraft.snapshot().busy ||
      controller.snapshot().conflict,
    [controller, routeDraft]
  )
  const execute = useCallback(
    async (input: HexTravelCommand): Promise<HexTravelCommandState> => {
      if (
        maintenanceDraftCoordinator.isLocked() ||
        controller.held() ||
        routeDraft.snapshot().busy ||
        controller.snapshot().conflict
      )
        throw new CapabilityError('stale', false)
      result.current = null
      const succeeded = await controller.execute(input)
      if (!succeeded || !result.current)
        throw new CapabilityError('outcome_unknown', true)
      return result.current
    },
    [controller, routeDraft]
  )
  const executor = useMemo(
    () => ({ execute, refresh: port.refresh }),
    [execute, port]
  )
  return {
    executor,
    routeDraft,
    blocked,
    busy: maintenance || routeState.busy || controller.held() || state.conflict,
    notice: (
      <>
        {routeState.error ? (
          <aside role="alert" aria-label={message('travel.routeDraft')}>
            {routeState.error}
          </aside>
        ) : null}
        {state.error ? (
          <aside role="alert" aria-label={message('travel.commands')}>
            <p>{state.error}</p>
            {state.uncertain ? (
              <button
                disabled={maintenance || state.busy}
                onClick={() => {
                  if (!maintenanceDraftCoordinator.isLocked())
                    void controller.settle()
                }}
              >
                {message('character.checkSavedState')}
              </button>
            ) : controller.held() ? (
              <>
                <button
                  disabled={maintenance || state.busy || state.conflict}
                  onClick={() => {
                    if (!maintenanceDraftCoordinator.isLocked())
                      void controller.save().catch(() => undefined)
                  }}
                >
                  {message('group.retryLifecycle')}
                </button>
                <button
                  disabled={maintenance || state.busy}
                  onClick={() => {
                    if (!maintenanceDraftCoordinator.isLocked())
                      void controller.discard()
                  }}
                >
                  {message('group.discardLifecycle')}
                </button>
              </>
            ) : null}
          </aside>
        ) : null}
      </>
    )
  }
}
