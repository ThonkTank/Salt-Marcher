import { presentCapabilityError } from '../../../capabilities/capability-errors.js'
import { message } from '../../../i18n/hex-runtime.de.js'
import type { HexWorldLocationCreationIntegrationProps } from '../../hex/hex-world-location-creation-port.js'
import type { HexMapApplicationPort } from '../../hex/hex-map-creation-port.js'
import type { WorldLocationApplicationPort } from '../../worldplanner/world-location-application.js'
import { useWorldLocationCreationWorkflow } from '../../worldplanner/use-world-location-creation-workflow.js'
import { worldLocationPlacementFailureText } from '../../worldplanner/world-location-placement-messages.js'
import type { WorldLocationRelatedCreation } from '../../worldplanner/world-location-editor-types.js'
import { IntegratedWorldLocationEditor } from './integrated-world-location-editor.js'

export function IntegratedWorldLocationCreation(
  props: HexWorldLocationCreationIntegrationProps & {
    port: WorldLocationApplicationPort
    suggestTags: (query: string, limit?: number) => Promise<readonly string[]>
    relatedCreation: WorldLocationRelatedCreation
    mapCreation: HexMapApplicationPort
    onError: (message: string) => void
  }
) {
  const workflow = useWorldLocationCreationWorkflow({
    port: props.port,
    applyCreated: props.applyCreated,
    select: props.select,
    presentError: (cause) => presentCapabilityError(cause, props.onError),
    savingMessage: message('ui.speichern.laeuft'),
    initiallyOpen: true
  })
  if (!workflow.dialogOpen) return null
  return (
    <IntegratedWorldLocationEditor
      location={null}
      references={workflow.references}
      initialPlacementHint={props.initialPlacementHint}
      close={props.close}
      save={async (draft, placement) => {
        const result = await workflow.save(draft, placement)
        if (result.status === 'saved') props.close()
        return result
      }}
      port={props.projectionPort}
      suggestTags={props.suggestTags}
      failureText={worldLocationPlacementFailureText}
      relatedCreation={props.relatedCreation}
      mapCreation={props.mapCreation}
      onError={props.onError}
    />
  )
}
