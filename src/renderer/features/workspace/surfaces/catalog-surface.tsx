import CatalogWorkspace from '../../catalog/catalog-workspace.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'

export default function CatalogSurface(props: WorkspaceSurfaceProps) {
  return (
    <CatalogWorkspace
      snapshot={props.snapshot}
      setSnapshot={props.setSnapshot}
      close={props.returnToSession}
      inspect={props.inspect}
      onError={props.onError}
    />
  )
}
