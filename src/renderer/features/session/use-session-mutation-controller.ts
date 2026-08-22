import type { Dispatch, SetStateAction } from 'react'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { applySceneGroupCommandResult } from './session-patches.js'

export function useSessionMutationController(input: {
  snapshot: LiveSessionSnapshot
  setSnapshot: Dispatch<SetStateAction<LiveSessionSnapshot>>
  onError: (message: string) => void
}) {
  const commands = useAsyncCommandCoordinator()

  return {
    mutateGroup: async (
      operation: (group: SceneGroup) => Promise<SceneGroupCommandResult>,
      group: SceneGroup
    ): Promise<void> => {
      const outcome = await commands.run({
        scope: 'session.group-mutation',
        entityKey: group.id,
        mode: 'latest-only',
        execute: () => operation(group)
      })
      if (outcome.status === 'success') {
        input.setSnapshot((current) =>
          applySceneGroupCommandResult(current, outcome.value)
        )
      } else if (outcome.status === 'failure')
        input.onError(capabilityErrorText(outcome.cause))
    },
    mutateSnapshot: async (
      operation: (snapshot: LiveSessionSnapshot) => Promise<LiveSessionSnapshot>
    ): Promise<void> => {
      const outcome = await commands.run({
        scope: 'session.snapshot-mutation',
        mode: 'latest-only',
        execute: () => operation(input.snapshot)
      })
      if (outcome.status === 'success') input.setSnapshot(outcome.value)
      else if (outcome.status === 'failure')
        input.onError(capabilityErrorText(outcome.cause))
    }
  }
}
