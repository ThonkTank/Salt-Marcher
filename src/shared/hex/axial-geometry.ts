import type { AxialCoordinate } from '../contracts/hex.js'

export const HEX_CHUNK_SIZE = 32
/** Internal mathematical radius; the editor presents this as brush level 1..10. */
export const MAX_HEX_BRUSH_RADIUS = 9
export const MAX_HEX_STROKE_POINTS = 4_096
export const MAX_HEX_STROKE_TILES = 50_000
export const MAX_HEX_STROKE_CHUNKS = 64

export function axialCoordinateId(coordinate: AxialCoordinate): string {
  return `${coordinate.q}:${coordinate.r}`
}

export function hexChunkKeyFor(coordinate: AxialCoordinate): AxialCoordinate {
  return {
    q: Math.floor(coordinate.q / HEX_CHUNK_SIZE),
    r: Math.floor(coordinate.r / HEX_CHUNK_SIZE)
  }
}

export function expandHexStroke(
  path: readonly AxialCoordinate[],
  radius: number,
  maximum = MAX_HEX_STROKE_TILES
): AxialCoordinate[] | null {
  if (
    path.length === 0 ||
    path.length > MAX_HEX_STROKE_POINTS ||
    !Number.isInteger(radius) ||
    radius < 0 ||
    radius > MAX_HEX_BRUSH_RADIUS
  )
    return null
  const centers = new Map<string, AxialCoordinate>()
  for (let index = 0; index < path.length; index += 1) {
    const current = path[index]!
    const previous = path[index - 1]
    const line = previous ? axialLine(previous, current) : [current]
    if (line === null) return null
    for (const point of line) {
      centers.set(axialCoordinateId(point), point)
      if (centers.size > maximum) return null
    }
  }
  const expanded = new Map<string, AxialCoordinate>()
  for (const center of centers.values())
    for (let q = -radius; q <= radius; q += 1)
      for (
        let r = Math.max(-radius, -q - radius);
        r <= Math.min(radius, -q + radius);
        r += 1
      ) {
        const coordinate = { q: center.q + q, r: center.r + r }
        if (
          !Number.isSafeInteger(coordinate.q) ||
          !Number.isSafeInteger(coordinate.r)
        )
          return null
        expanded.set(axialCoordinateId(coordinate), coordinate)
        if (expanded.size > maximum) return null
      }
  return [...expanded.values()]
}

function axialLine(
  from: AxialCoordinate,
  to: AxialCoordinate
): AxialCoordinate[] | null {
  const distance = Math.max(
    Math.abs(from.q - to.q),
    Math.abs(from.r - to.r),
    Math.abs(-from.q - from.r + to.q + to.r)
  )
  if (!Number.isSafeInteger(distance) || distance > MAX_HEX_STROKE_TILES)
    return null
  if (distance === 0) return [from]
  return Array.from({ length: distance + 1 }, (_, index) => {
    const amount = index / distance
    return cubeRound(
      from.q + (to.q - from.q) * amount,
      from.r + (to.r - from.r) * amount
    )
  })
}

function cubeRound(q: number, r: number): AxialCoordinate {
  const y = -q - r
  let roundedQ = Math.round(q)
  const roundedY = Math.round(y)
  let roundedR = Math.round(r)
  const qDifference = Math.abs(roundedQ - q)
  const yDifference = Math.abs(roundedY - y)
  const rDifference = Math.abs(roundedR - r)
  if (qDifference > yDifference && qDifference > rDifference)
    roundedQ = -roundedY - roundedR
  else if (yDifference <= rDifference) roundedR = -roundedQ - roundedY
  return { q: roundedQ, r: roundedR }
}
