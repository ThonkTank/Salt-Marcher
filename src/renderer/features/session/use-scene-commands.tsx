import { CapabilityError } from '../../../shared/errors/capability-error.js'
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import type { SceneCommand } from '../../../shared/contracts/scene-command.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useDraftTransition } from '../../shell/use-draft-transition.js'
import { message } from '../../i18n/session-runtime.de.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { SceneCommandController } from './scene-command-controller.js'
import {
  useSceneCommandPort,
  type SceneCommandPort
} from './use-scene-command-port.js'

type Build = (current: LiveSessionSnapshot) => SceneCommand['command'] | null
type Completed = (current: LiveSessionSnapshot) => void
export function useSceneCommands(
  campaignId: string,
  sceneId: string,
  onError: (text: string) => void,
  completed?: Completed
) {
  return useSceneCommandOwner(
    useSceneCommandPort(campaignId),
    sceneId,
    onError,
    completed
  )
}
export function useSceneCommandOwner(
  port: SceneCommandPort,
  sceneId: string,
  onError: (text: string) => void,
  completed?: Completed
) {
  const ownerId = useId()
  const controller = useMemo(() => new SceneCommandController(port), [port])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot)
  const [localError, setLocalError] = useState<string | null>(null)
  const completion = useRef<Completed | undefined>(undefined)
  const observer = useRef(completed)
  useLayoutEffect(() => {
    observer.current = completed
  })
  useLayoutEffect(() => {
    controller.attach((_receipt, current) => {
      completion.current?.(current)
      completion.current = undefined
      observer.current?.(current)
    })
    return controller.detach
  }, [controller])
  const maintenance = useMaintenanceDraft(
    {
      label: 'Szenenaktionen',
      isDirty: controller.held,
      save: controller.save,
      discard: controller.discard
    },
    ownerId
  )
  const transition = useDraftTransition(sceneId, {
    title: message('scene.resolveTitle'),
    text: message('scene.resolveText')
  })
  const blocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    controller.held() ||
    controller.snapshot().conflict
  const current = () => {
    const snapshot = port.current()
    if (snapshot.scene.focusedSceneId !== sceneId)
      throw new Error(message('scene.commandConflict'))
    return snapshot
  }
  const perform = async (
    build: Build,
    confirmed?: Completed,
    duringMaintenance = false
  ): Promise<boolean> => {
    if (
      controller.held() ||
      controller.snapshot().conflict ||
      (!duringMaintenance && maintenanceDraftCoordinator.isLocked())
    )
      return false
    try {
      const command = build(current())
      if (!command) return false
      completion.current = confirmed
      setLocalError(null)
      return await controller.execute({
        commandId: crypto.randomUUID(),
        command
      })
    } catch (cause) {
      const text =
        cause instanceof Error && !(cause instanceof CapabilityError)
          ? cause.message
          : capabilityErrorText(cause)
      setLocalError(text)
      onError(text)
      return false
    }
  }
  const error = state.error ?? localError
  return {
    ownerId,
    blocked,
    current,
    perform,
    busy: maintenance || controller.held() || state.conflict,
    request: (build: Build) =>
      transition.request(() => {
        void perform(build)
      }),
    dialog: transition.dialog,
    notice: error ? (
      <aside role="alert">
        <p>{error}</p>
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
                      onError(capabilityErrorText(cause))
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
export type SceneCommands = ReturnType<typeof useSceneCommandOwner>
