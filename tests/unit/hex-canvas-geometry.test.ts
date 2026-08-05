import { describe, expect, it } from 'vitest'
import {
  center,
  chunkId,
  pixelToAxial,
  polygon
} from '../../src/renderer/features/hex/hex-canvas-geometry.js'

describe('hex canvas geometry', () => {
  it('round-trips positive and negative axial coordinates', () => {
    for (const coordinate of [
      { q: 0, r: 0 },
      { q: 17, r: -9 },
      { q: -65, r: 64 }
    ]) {
      const point = center(coordinate)
      expect(pixelToAxial(point.x, point.y)).toEqual(coordinate)
    }
  })

  it('builds six-corner polygons and stable sparse chunk identities', () => {
    expect(polygon(0, 0, 27)).toHaveLength(12)
    expect(chunkId({ q: 31, r: -1 })).toBe('0:-1')
    expect(chunkId({ q: 32, r: 0 })).toBe('1:0')
  })
})
