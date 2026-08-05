import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { expandHexStroke } from '../../../shared/hex/axial-geometry.js'

/** @deprecated Prefer the shared canonical name in new code. */
export function expandHexBrush(
  path: readonly AxialCoordinate[],
  radius: number
): AxialCoordinate[] {
  return expandHexStroke(path, radius) ?? []
}
