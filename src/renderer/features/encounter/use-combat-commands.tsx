import { CapabilityError } from '../../../shared/errors/capability-error.js'
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import type { CombatCommand } from '../../../shared/contracts/combat-command.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useDraftTransition } from '../../shell/use-draft-transition.js'
import { message } from '../../i18n/session-runtime.de.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { CombatCommandController } from './combat-command-controller.js'
import {
  useCombatCommandPort,
  type CombatCommandPort
} from './use-combat-command-port.js'

type Build = (current: LiveSessionSnapshot) => CombatCommand['command'] | null
type Completed = (current: LiveSessionSnapshot) => void
export function useCombatCommands(
  campaignId: string,
  sceneId: string,
  onError: (text: string) => void
) {
  return useCombatCommandOwner(
    useCombatCommandPort(campaignId),
    sceneId,
    onError
  )
}
export function useCombatCommandOwner(
  port: CombatCommandPort,
  sceneId: string,
  onError: (text: string) => void,
  completed?: Completed
) {
  const ownerId = useId()
  const controller = useMemo(() => new CombatCommandController(port), [port])
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
      label: 'Kampfaktionen',
      isDirty: controller.held,
      save: controller.save,
      discard: controller.discard
    },
    ownerId
  )
  const transition = useDraftTransition(sceneId, {
    title: message('combat.resolveTitle'),
    text: message('combat.resolveText')
  })
  const blocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    controller.held() ||
    controller.snapshot().conflict
  const current = () => {
    const snapshot = port.current()
    if (snapshot.scene.focusedSceneId !== sceneId)
      throw new Error(message('combat.commandConflict'))
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
        sceneId,
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
export type CombatCommands = ReturnType<typeof useCombatCommandOwner>
