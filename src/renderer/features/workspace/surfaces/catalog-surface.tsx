import CatalogWorkspace from '../../catalog/catalog-workspace.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'
import { useWorldLocationEditingIntegration } from '../integrations/world-location-editing.js'

export default function CatalogSurface(props: WorkspaceSurfaceProps) {
  const worldLocationEditing = useWorldLocationEditingIntegration({
    inspect: props.inspect,
    onError: props.onError
  })
  return (
    <CatalogWorkspace
      campaignId={props.campaignId}
      setSnapshot={props.setSnapshot}
      inspect={props.inspect}
      onError={props.onError}
      worldLocationEditing={worldLocationEditing}
    />
  )
}
