import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useSceneCommands } from './use-scene-commands.js'
import { draftConcern } from '../../shell/maintenance-draft-coordinator.js'

export function useSessionSceneController(input: {
  campaignId: string
  sceneId: string
  onError: (text: string) => void
  applied: (snapshot: LiveSessionSnapshot) => void
}) {
  const commands = useSceneCommands(
    input.campaignId,
    input.sceneId,
    input.onError,
    input.applied
  )
  return {
    focus: (sceneId: string) =>
      commands.request(
        (current) => ({
          kind: 'focus',
          input: {
            sceneId,
            sourceSceneId: input.sceneId,
            expectedRevision: current.scene.revision
          }
        }),
        {
          kind: 'concerns',
          concerns: [draftConcern.scene(input.sceneId)]
        }
      ),
    setLocation: (locationId: string | null) =>
      commands.request(
        (current) => ({
          kind: 'set-location',
          input: {
            sceneId: input.sceneId,
            locationId,
            expectedRevision: current.scene.revision
          }
        }),
        { kind: 'concerns', concerns: [] }
      ),
    notice: commands.notice,
    dialog: commands.dialog,
    busy: commands.busy
  }
}
