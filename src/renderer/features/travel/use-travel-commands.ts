import type { useTravelQueries } from './use-travel-queries.js'
import { useTravelCommandTransition } from './use-travel-command-transition.js'
import type { TravelRouteDraft } from './use-travel-route-draft.js'
import { useCallback, useEffect, useRef } from 'react'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { sameTravelScope, type TravelScope } from './travel-controller.js'
import type {
  TravelProviderCommand,
  TravelProviderPort,
  TravelMultiplier
} from './travel-provider-port.js'
import type { TravelViewProjection } from './travel-view-projection.js'

const multipliers = [1, 2, 5, 10] as const
/** Publishes command results; the provider owns durable execution and recovery. */
export function useTravelCommands<P, S, M, E>(options: {
  blocked: () => boolean
  requestTransition: (run: () => Promise<void>) => Promise<void> | undefined
  prepareCommand: ReturnType<
    typeof useTravelQueries<P, S, M, E>
  >['prepareCommand']
  routeDraft: TravelRouteDraft<P> | undefined
  port: TravelProviderPort<P, S, M, E> | null
  scope: TravelScope | null
  projection: TravelViewProjection<P, S, M, E>
  onError: (message: string) => void
}) {
  const {
    blocked,
    onError,
    port,
    projection,
    scope,
    routeDraft,
    requestTransition,
    prepareCommand
  } = options
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
        blocked() ||
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
      try {
        const result = await port.execute(command)
        acceptCommand({
          target,
          result,
          descriptor: port.describe(result.providerState),
          clearDraft,
          describe: port.describe
        })
      } catch (cause) {
        const message = capabilityErrorText(cause)
        if (failed(target, 'scope', 'command', message))
          onErrorRef.current(message)
      }
    },
    [
      acceptCommand,
      beginIntent,
      blocked,
      capture,
      failed,
      port,
      read,
      scope,
      started
    ]
  )

  const requestCommand = useTravelCommandTransition({
    requestTransition,
    prepareCommand,
    blocked,
    port,
    scope,
    projection,
    routeDraft,
    execute: applyCommand,
    onError
  })

  const positionParty = useCallback(
    async (position: P): Promise<void> => {
      if (blocked()) return
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
      await requestCommand(
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
    [requestCommand, blocked, local, port, read, sceneRevision]
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
    await requestCommand(
      {
        kind: 'start',
        sceneId: current.scope!.sceneId,
        mapId: current.mapId,
        waypoints: current.waypoints,
        multiplier: current.multiplier,
        expectedRevision: port.describe(current.providerState).revision,
        expectedSceneRevision: sceneRevision()
      },
      true
    )
  }, [requestCommand, port, read, sceneRevision])

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
    await requestCommand(
      {
        kind,
        sceneId: current.scope!.sceneId,
        expectedRevision: descriptor.revision,
        expectedSceneRevision: sceneRevision()
      },
      false
    )
  }, [requestCommand, port, read, sceneRevision])

  const abort = useCallback(async (): Promise<void> => {
    const current = read()
    if (current.lifecycle !== 'ready' || !port || !current.providerState) return
    const descriptor = port.describe(current.providerState)
    if (!['travelling', 'paused', 'blocked'].includes(descriptor.status)) return
    await requestCommand(
      {
        kind: 'abort',
        sceneId: current.scope!.sceneId,
        expectedRevision: descriptor.revision,
        expectedSceneRevision: sceneRevision()
      },
      false
    )
  }, [requestCommand, port, read, sceneRevision])

  const stepMultiplier = useCallback(
    async (direction: -1 | 1): Promise<void> => {
      if (blocked()) return
      const current = read()
      const index = multipliers.indexOf(current.multiplier)
      const multiplier = multipliers[index + direction]
      if (multiplier === undefined) return
      if (routeDraft && current.mode === 'plan') {
        const plan = routeDraft.snapshot().plan
        if (
          plan &&
          plan.mapId === current.mapId &&
          !routeDraft.edit({ ...plan, multiplier })
        )
          return
        publishLocalMultiplier(local, multiplier)
        return
      }
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
      await requestCommand(
        {
          kind: 'set-multiplier',
          sceneId: current.scope!.sceneId,
          multiplier,
          expectedRevision: descriptor.revision,
          expectedSceneRevision: sceneRevision()
        },
        false,
        direction
      )
    },
    [requestCommand, blocked, local, port, read, sceneRevision, routeDraft]
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
