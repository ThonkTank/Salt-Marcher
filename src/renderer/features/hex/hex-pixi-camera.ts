import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import {
  center,
  hexSize,
  pixelToAxial,
  rootThree
} from './hex-canvas-geometry.js'

const HEX_CHUNK_MARGIN = 32
type MutablePoint = { x: number; y: number; set(x: number, y?: number): void }
export type HexCameraState = {
  element: HTMLDivElement
  mapId: string
  world: { position: MutablePoint; scale: MutablePoint }
  cameraByMap: Map<string, Readonly<{ x: number; y: number; scale: number }>>
}

export function viewportCenter(state: HexCameraState) {
  return pixelToAxial(
    (state.element.clientWidth / 2 - state.world.position.x) /
      state.world.scale.x,
    (state.element.clientHeight / 2 - state.world.position.y) /
      state.world.scale.y
  )
}

export function viewportMetrics(state: HexCameraState) {
  const currentCenter = viewportCenter(state)
  const horizontal = Math.ceil(
    state.element.clientWidth / (hexSize * rootThree * state.world.scale.x) / 2
  )
  const vertical = Math.ceil(
    state.element.clientHeight / (hexSize * 1.5 * state.world.scale.y) / 2
  )
  return {
    center: currentCenter,
    halfExtent: Math.max(horizontal, vertical) + HEX_CHUNK_MARGIN
  }
}

export function resetCamera(
  state: HexCameraState,
  coordinate: AxialCoordinate
) {
  const point = center(coordinate)
  state.world.scale.set(1)
  state.world.position.set(
    state.element.clientWidth / 2 - point.x,
    state.element.clientHeight / 2 - point.y
  )
}

export function rememberCamera(state: HexCameraState) {
  state.cameraByMap.set(state.mapId, {
    x: state.world.position.x,
    y: state.world.position.y,
    scale: state.world.scale.x
  })
}
