import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { sessionCapabilities } from './session-capabilities.js'

type CapabilityApi = ReturnType<typeof useCapabilityApi>

export function useSessionSceneController(input: {
  api: CapabilityApi
  mutateSnapshot: (
    operation: (snapshot: LiveSessionSnapshot) => Promise<LiveSessionSnapshot>
  ) => Promise<void>
}) {
  const capabilities = sessionCapabilities(input.api).scene

  return {
    focus: (sceneId: string) =>
      void input.mutateSnapshot((current) =>
        capabilities.focus(sceneId, current.scene.revision)
      ),
    setLocation: (locationId: string | null) =>
      void input.mutateSnapshot((current) =>
        capabilities.setLocation(
          current.scene.focusedSceneId,
          locationId,
          current.scene.revision
        )
      ),
    assignPartyMember: (memberId: string, assigned: boolean) =>
      void input.mutateSnapshot((current) =>
        capabilities.assignPartyMember(
          current.scene.focusedSceneId,
          memberId,
          assigned,
          current.scene.revision
        )
      )
  } as const
}
