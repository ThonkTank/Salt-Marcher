import { CapabilityError } from '../../../shared/errors/capability-error.js'
import type {
  TravelProviderCommand,
  TravelProviderPort,
  TravelRoutePlanSnapshot
} from './travel-provider-port.js'

/** Reads only: the existing command owner receives the resolved immutable intent. */
export async function prepareTravelCommand<P, S, M, E>(options: {
  command: TravelProviderCommand<P>
  port: TravelProviderPort<P, S, M, E>
  route?: Readonly<{
    plan: TravelRoutePlanSnapshot<P>['plan']
    savedRevision: number | null
  }>
  multiplierDirection?: -1 | 1
}) {
  const { command, port } = options
  const result = await port.read({ sceneId: command.sceneId })
  const descriptor = port.describe(result.providerState)
  if (
    result.session.scene.focusedSceneId !== command.sceneId ||
    descriptor.routePlan.sceneId !== command.sceneId
  )
    throw new CapabilityError('stale', false)
  const scene = {
    sceneId: command.sceneId,
    expectedSceneRevision: result.session.scene.revision
  }
  const journey = { ...scene, expectedRevision: descriptor.revision }
  let prepared: TravelProviderCommand<P> | null = null
  switch (command.kind) {
    case 'position': {
      const map = await port.readMap({ mapId: command.mapId, force: true })
      if (!port.isAuthoredPosition(map, command.position))
        throw new CapabilityError('validation_failed', false)
      prepared = { ...command, ...scene }
      break
    }
    case 'start': {
      const route = options.route
      if (route && route.savedRevision !== descriptor.routePlan.revision)
        throw new CapabilityError('stale', false)
      const plan = route ? route.plan : command
      if (!plan || plan.mapId !== command.mapId || plan.waypoints.length === 0)
        break
      const evaluation = await port.evaluate({
        sceneId: command.sceneId,
        mapId: plan.mapId,
        waypoints: plan.waypoints
      })
      if (!port.canStart(evaluation))
        throw new CapabilityError('validation_failed', false)
      prepared = {
        kind: 'start',
        ...journey,
        mapId: plan.mapId,
        waypoints: [...plan.waypoints],
        multiplier: plan.multiplier
      }
      break
    }
    case 'pause':
      if (descriptor.status === 'travelling')
        prepared = { kind: 'pause', ...journey }
      break
    case 'resume':
      if (['paused', 'blocked'].includes(descriptor.status))
        prepared = { kind: 'resume', ...journey }
      break
    case 'abort':
      if (['travelling', 'paused', 'blocked'].includes(descriptor.status))
        prepared = { kind: 'abort', ...journey }
      break
    case 'set-multiplier': {
      if (
        !['travelling', 'paused', 'blocked', 'completed', 'aborted'].includes(
          descriptor.status
        )
      )
        break
      const multipliers = [1, 2, 5, 10] as const
      const multiplier =
        options.multiplierDirection === undefined
          ? command.multiplier
          : multipliers[
              multipliers.indexOf(descriptor.multiplier) +
                options.multiplierDirection
            ]
      if (multiplier !== undefined && multiplier !== descriptor.multiplier)
        prepared = { kind: 'set-multiplier', ...journey, multiplier }
      break
    }
  }
  return { command: prepared, result, descriptor }
}
