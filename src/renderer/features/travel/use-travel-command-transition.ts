import { useCallback } from 'react'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { sameTravelScope, type TravelScope } from './travel-controller.js'
import type {
  TravelProviderCommand,
  TravelProviderPort
} from './travel-provider-port.js'
import type { TravelViewProjection } from './travel-view-projection.js'
import type { TravelRouteDraft } from './use-travel-route-draft.js'
import type { useTravelQueries } from './use-travel-queries.js'

export function useTravelCommandTransition<P, S, M, E>(options: {
  requestTransition: (run: () => Promise<void>) => Promise<void> | undefined
  prepareCommand: ReturnType<
    typeof useTravelQueries<P, S, M, E>
  >['prepareCommand']
  blocked: () => boolean
  port: TravelProviderPort<P, S, M, E> | null
  scope: TravelScope | null
  projection: TravelViewProjection<P, S, M, E>
  routeDraft: TravelRouteDraft<P> | undefined
  execute: (
    command: TravelProviderCommand<P>,
    clearDraft: boolean
  ) => Promise<void>
  onError: (message: string) => void
}) {
  const {
    requestTransition,
    prepareCommand,
    blocked,
    port,
    scope,
    projection,
    routeDraft,
    execute,
    onError
  } = options
  const { capture, isCurrent, read, acceptContext, failed } = projection
  return useCallback(
    (
      command: TravelProviderCommand<P>,
      clearDraft: boolean,
      multiplierDirection?: -1 | 1
    ): Promise<void> => {
      if (
        blocked() ||
        !port ||
        !scope ||
        read().lifecycle !== 'ready' ||
        !sameTravelScope(read().scope, scope)
      )
        return Promise.resolve()
      const target = capture()
      if (!target) return Promise.resolve()
      const original = structuredClone(command)
      const needsResolution = maintenanceDraftCoordinator.hasDirty()
      return (
        requestTransition(() => {
          if (blocked() || !isCurrent(target)) return Promise.resolve()
          // Journey and position controls use a fresh revision, including after
          // an earlier command publishes before the workspace refresh settles.
          if (!needsResolution && original.kind === 'start')
            return execute(original, clearDraft)
          return (async () => {
            const held = maintenanceDraftCoordinator.begin()
            let next: TravelProviderCommand<P> | null = null
            try {
              if ((await held.resolve('check')).length)
                throw new CapabilityError('stale', false)
              const route = routeDraft?.snapshot()
              const preparation = await prepareCommand({
                command: original,
                ...(route
                  ? {
                      route: {
                        plan: structuredClone(route.plan),
                        savedRevision: route.savedRevision
                      }
                    }
                  : {}),
                ...(multiplierDirection === undefined
                  ? {}
                  : { multiplierDirection })
              })
              if (preparation.status === 'failure') throw preparation.cause
              if (preparation.status !== 'success' || !isCurrent(target)) return
              const prepared = preparation.value
              const view = read()
              if (original.kind === 'start' && view.mapId !== original.mapId)
                return
              const freshTarget = capture()
              if (
                !freshTarget ||
                !acceptContext({
                  target: freshTarget,
                  result: prepared.result,
                  descriptor: prepared.descriptor,
                  mapId: view.mapId,
                  map: view.map,
                  describe: port.describe
                })
              )
                throw new CapabilityError('stale', false)
              next = prepared.command
            } catch (cause) {
              const text = capabilityErrorText(cause)
              if (failed(target, 'scope', 'command', text)) onError(text)
            } finally {
              held.release()
            }
            if (next && isCurrent(target) && !blocked())
              await execute(next, clearDraft)
          })()
        }) ?? Promise.resolve()
      )
    },
    [
      acceptContext,
      blocked,
      capture,
      execute,
      failed,
      isCurrent,
      onError,
      port,
      read,
      requestTransition,
      prepareCommand,
      routeDraft,
      scope
    ]
  )
}
