import { useRef, type Dispatch, type SetStateAction } from 'react'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { applySceneGroupCommandResult } from './session-patches.js'

export function useSessionMutationController(input: {
  snapshot: LiveSessionSnapshot
  setSnapshot: Dispatch<SetStateAction<LiveSessionSnapshot>>
  onError: (message: string) => void
}) {
  const latestSnapshotRequest = useRef(0)
  const latestGroupRequest = useRef(new Map<string, number>())

  return {
    mutateGroup: async (
      operation: (group: SceneGroup) => Promise<SceneGroupCommandResult>,
      group: SceneGroup
    ): Promise<void> => {
      const request = (latestGroupRequest.current.get(group.id) ?? 0) + 1
      latestGroupRequest.current.set(group.id, request)
      try {
        const result = await operation(group)
        if (latestGroupRequest.current.get(group.id) !== request) return
        input.setSnapshot((current) =>
          applySceneGroupCommandResult(current, result)
        )
      } catch (cause) {
        input.onError(capabilityErrorText(cause))
      }
    },
    mutateSnapshot: async (
      operation: (snapshot: LiveSessionSnapshot) => Promise<LiveSessionSnapshot>
    ): Promise<void> => {
      const request = ++latestSnapshotRequest.current
      try {
        const result = await operation(input.snapshot)
        if (latestSnapshotRequest.current === request) input.setSnapshot(result)
      } catch (cause) {
        input.onError(capabilityErrorText(cause))
      }
    }
  }
}
