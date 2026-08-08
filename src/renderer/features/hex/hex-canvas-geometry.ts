import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { hexChunkKeyFor } from '../../../shared/hex/axial-geometry.js'

export const rootThree = Math.sqrt(3)
export const hexSize = 27

export function center(coordinate: AxialCoordinate, size = hexSize) {
  return {
    x: size * rootThree * (coordinate.q + coordinate.r / 2),
    y: size * 1.5 * coordinate.r
  }
}

export function polygon(x: number, y: number, size: number): number[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180
    return [x + size * Math.cos(angle), y + size * Math.sin(angle)]
  }).flat()
}

export function pixelToAxial(
  x: number,
  y: number,
  size = hexSize
): AxialCoordinate {
  const q = ((rootThree / 3) * x - y / 3) / size
  const r = ((2 / 3) * y) / size
  const cube = { x: q, z: r, y: -q - r }
  let rx = Math.round(cube.x)
  const ry = Math.round(cube.y)
  let rz = Math.round(cube.z)
  const dx = Math.abs(rx - cube.x)
  const dy = Math.abs(ry - cube.y)
  const dz = Math.abs(rz - cube.z)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy <= dz) rz = -rx - ry
  return { q: rx, r: rz }
}

export function coordinateId(coordinate: AxialCoordinate): string {
  return `${coordinate.q}:${coordinate.r}`
}

export function chunkId(coordinate: AxialCoordinate): string {
  const key = hexChunkKeyFor(coordinate)
  return `${key.q}:${key.r}`
}
