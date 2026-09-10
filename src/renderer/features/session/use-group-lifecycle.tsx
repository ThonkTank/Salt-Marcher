import {
  useEffect,
  useId,
  useRef,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore
} from 'react'
import type { SceneGroupLifecycleCommand } from '../../../shared/contracts/scene-group-lifecycle.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import {
  draftConcern,
  maintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import { message } from '../../i18n/session-runtime.de.js'
import { GroupLifecycleController } from './group-lifecycle-controller.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import {
  type GroupLifecyclePort,
  useGroupLifecyclePort
} from './use-group-lifecycle-port.js'
export function useGroupLifecycle(
  campaignId: string,
  onError: (text: string) => void,
  sceneId?: string
) {
  return useGroupLifecycleOwner(
    useGroupLifecyclePort(campaignId),
    onError,
    undefined,
    sceneId
  )
}

export function useGroupLifecycleOwner(
  port: GroupLifecyclePort,
  onError: (text: string) => void,
  onCompleted?: (snapshot: LiveSessionSnapshot) => void,
  sceneId?: string
) {
  const ownerId = useId()
  const completion = useRef(onCompleted)
  useLayoutEffect(() => {
    completion.current = onCompleted
  })
  const controller = useMemo(() => new GroupLifecycleController(port), [port])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot)
  useLayoutEffect(() => {
    controller.attach((_receipt, current) => completion.current?.(current))
    return controller.detach
  }, [controller])
  const maintenance = useMaintenanceDraft(
    {
      label: 'Gruppenaktionen',
      concerns: sceneId ? [draftConcern.scene(sceneId)] : [],
      isDirty: controller.held,
      settleBackgroundWrites: async () => {
        await controller.settle()
      },
      save: controller.save,
      discard: controller.discard
    },
    ownerId
  )
  useEffect(() => {
    if (state.error) onError(state.error)
  }, [state.error, onError])
  const blocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    controller.held() ||
    controller.snapshot().conflict
  return {
    ownerId,
    blocked,
    busy: maintenance || controller.held() || state.conflict,
    execute: (command: SceneGroupLifecycleCommand['command']) => {
      if (!blocked())
        void controller.execute({ commandId: crypto.randomUUID(), command })
    },
    notice: state.error ? (
      <aside role="alert">
        <p>{state.error}</p>
        {state.uncertain && (
          <button
            disabled={maintenance || state.busy}
            onClick={() => {
              if (!maintenanceDraftCoordinator.isLocked())
                void controller.settle()
            }}
          >
            {message('character.checkSavedState')}
          </button>
        )}
        {!state.uncertain && controller.held() && (
          <>
            <button
              disabled={maintenance || state.busy || state.conflict}
              onClick={() => {
                if (
                  !maintenanceDraftCoordinator.isLocked() &&
                  !controller.snapshot().conflict
                )
                  void controller
                    .save()
                    .catch((cause: unknown) =>
                      onError(
                        cause instanceof Error
                          ? cause.message
                          : message('group.lifecycleConflict')
                      )
                    )
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
        )}
      </aside>
    ) : null
  }
}
