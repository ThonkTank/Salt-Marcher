import HexEditor from '../../hex/hex-editor.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'
import { useWorldLocationEditingIntegration } from '../integrations/world-location-editing.js'

export default function HexSurface(props: WorkspaceSurfaceProps) {
  const worldLocationEditing = useWorldLocationEditingIntegration({
    inspect: props.inspect,
    onError: props.onError
  })
  return (
    <HexEditor
      onError={props.onError}
      renderWorldLocationCreation={
        worldLocationEditing.renderCreationWithProjection
      }
    />
  )
}
