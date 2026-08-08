import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { expandHexStroke } from '../../../shared/hex/axial-geometry.js'

export function brushLevelToRadius(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 10)
    throw new RangeError('Brush level must be an integer from 1 through 10')
  return level - 1
}

/** @deprecated Prefer the shared canonical name in new code. */
export function expandHexBrush(
  path: readonly AxialCoordinate[],
  radius: number
): AxialCoordinate[] {
  return expandHexStroke(path, radius) ?? []
}
