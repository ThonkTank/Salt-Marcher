import { useCallback, useEffect, useRef } from 'react'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { sameTravelScope, type TravelScope } from './travel-controller.js'
import type {
  TravelProviderCommand,
  TravelProviderPort,
  TravelMultiplier
} from './travel-provider-port.js'
import type { TravelViewProjection } from './travel-view-projection.js'
import { travelEntityKey } from './use-travel-queries.js'

const multipliers = [1, 2, 5, 10] as const
/** Owns Scene-scoped FIFO Travel mutations and their domain failures. */
export function useTravelCommands<P, S, M, E>(options: {
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
    acceptCommand,
    beginIntent,
    capture,
    failed,
    local,
    read,
    sceneRevision,
    started
  } = projection

  const applyCommand = useCallback(
    async (
      command: TravelProviderCommand<P>,
      clearDraft: boolean
    ): Promise<void> => {
      if (
        !port ||
        !scope ||
        read().lifecycle !== 'ready' ||
        !sameTravelScope(read().scope, scope)
      )
        return
      beginIntent()
      const target = capture()
      if (!target) return
      started('command')
      const outcome = await coordinator.run({
        scope: 'travel.command',
        entityKey: travelEntityKey(scope),
        mode: 'queue',
        execute: async ({ signal }) => {
          const result = await port.execute(command)
          signal.throwIfAborted()
          return result
        },
        accept: (result) =>
          acceptCommand({
            target,
            result,
            descriptor: port.describe(result.providerState),
            clearDraft,
            describe: port.describe
          })
      })
      if (outcome.status !== 'failure') return
      const message = capabilityErrorText(outcome.cause)
      if (failed(target, 'scope', 'command', message))
        onErrorRef.current(message)
    },
    [
      acceptCommand,
      beginIntent,
      capture,
      coordinator,
      failed,
      port,
      read,
      scope,
      started
    ]
  )

  const positionParty = useCallback(
    async (position: P): Promise<void> => {
      const current = read()
      local({ type: 'selected', position }, 'intent')
      if (
        current.lifecycle !== 'ready' ||
        !port ||
        !current.map ||
        !current.mapId
      )
        return
      if (!port.isAuthoredPosition(current.map, position)) {
        local({ type: 'token-preview', position: null }, 'transient')
        return
      }
      await applyCommand(
        {
          kind: 'position',
          sceneId: current.scope!.sceneId,
          mapId: current.mapId,
          position,
          expectedSceneRevision: sceneRevision()
        },
        true
      )
    },
    [applyCommand, local, port, read, sceneRevision]
  )

  const start = useCallback(async (): Promise<void> => {
    const current = read()
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
        sceneId: current.scope!.sceneId,
        mapId: current.mapId,
        waypoints: current.waypoints,
        multiplier: current.multiplier,
        expectedRevision: port.describe(current.providerState).revision
      },
      true
    )
  }, [applyCommand, port, read])

  const pauseOrResume = useCallback(async (): Promise<void> => {
    const current = read()
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
      {
        kind,
        sceneId: current.scope!.sceneId,
        expectedRevision: descriptor.revision
      },
      false
    )
  }, [applyCommand, port, read])

  const abort = useCallback(async (): Promise<void> => {
    const current = read()
    if (current.lifecycle !== 'ready' || !port || !current.providerState) return
    const descriptor = port.describe(current.providerState)
    if (!['travelling', 'paused', 'blocked'].includes(descriptor.status)) return
    await applyCommand(
      {
        kind: 'abort',
        sceneId: current.scope!.sceneId,
        expectedRevision: descriptor.revision
      },
      false
    )
  }, [applyCommand, port, read])

  const stepMultiplier = useCallback(
    async (direction: -1 | 1): Promise<void> => {
      const current = read()
      const index = multipliers.indexOf(current.multiplier)
      const multiplier = multipliers[index + direction]
      if (multiplier === undefined) return
      if (!port || !current.providerState) {
        publishLocalMultiplier(local, multiplier)
        return
      }
      const descriptor = port.describe(current.providerState)
      if (!hasPersistedJourneyStatus(descriptor.status)) {
        publishLocalMultiplier(local, multiplier)
        return
      }
      if (current.lifecycle !== 'ready') return
      await applyCommand(
        {
          kind: 'set-multiplier',
          sceneId: current.scope!.sceneId,
          multiplier,
          expectedRevision: descriptor.revision
        },
        false
      )
    },
    [applyCommand, local, port, read]
  )

  return { positionParty, start, pauseOrResume, abort, stepMultiplier }
}

function publishLocalMultiplier<P, S, M, E>(
  local: TravelViewProjection<P, S, M, E>['local'],
  multiplier: TravelMultiplier
): void {
  local({ type: 'local-multiplier', multiplier }, 'intent')
}

function hasPersistedJourneyStatus(status: string): boolean {
  return ['travelling', 'paused', 'blocked', 'completed', 'aborted'].includes(
    status
  )
}
