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
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { HexTravelCommandController } from './hex-travel-command-controller.js'
import type { HexTravelCommandPort } from './use-hex-travel-command-port.js'

/** Owns pending commands independently of the visible Travel windows. */
export function useHexTravelCommandOwner(
  port: HexTravelCommandPort,
  completed: (current: HexTravelCommandState) => void
) {
  const controller = useMemo(() => new HexTravelCommandController(port), [port])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot)
  const result = useRef<HexTravelCommandState | null>(null)
  const observer = useRef(completed)
  useLayoutEffect(() => {
    observer.current = completed
  })
  useLayoutEffect(() => {
    controller.attach((_receipt, current) => {
      result.current = current
      observer.current(current)
    })
    return controller.detach
  }, [controller])
  const ownerId = useId()
  const maintenance = useMaintenanceDraft(
    {
      label: message('travel.commands'),
      isDirty: controller.held,
      save: controller.save,
      discard: controller.discard
    },
    ownerId
  )
  const blocked = useCallback(
    () =>
      maintenanceDraftCoordinator.isLocked() ||
      controller.held() ||
      controller.snapshot().conflict,
    [controller]
  )
  const execute = useCallback(
    async (input: HexTravelCommand): Promise<HexTravelCommandState> => {
      if (
        maintenanceDraftCoordinator.isLocked() ||
        controller.held() ||
        controller.snapshot().conflict
      )
        throw new CapabilityError('stale', false)
      result.current = null
      const succeeded = await controller.execute(input)
      if (!succeeded || !result.current)
        throw new CapabilityError('outcome_unknown', true)
      return result.current
    },
    [controller]
  )
  const executor = useMemo(
    () => ({ execute, refresh: port.refresh }),
    [execute, port]
  )
  return {
    executor,
    blocked,
    busy: maintenance || controller.held() || state.conflict,
    notice: state.error ? (
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
    ) : null
  }
}
