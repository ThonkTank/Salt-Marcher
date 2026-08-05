import HexEditor from '../../hex/hex-editor.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'

export default function HexSurface(props: WorkspaceSurfaceProps) {
  return <HexEditor onError={props.onError} />
}
