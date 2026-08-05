import { describe, expect, it } from 'vitest'
import {
  brushLevelToRadius,
  expandHexBrush
} from '../../src/renderer/features/hex/hex-brush.js'
import { expandHexStroke } from '../../src/shared/hex/axial-geometry.js'

describe('hex brush geometry', () => {
  it('maps the ten UI levels to the one canonical mathematical radius', () => {
    expect(
      Array.from({ length: 10 }, (_, index) => brushLevelToRadius(index + 1))
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(() => brushLevelToRadius(0)).toThrow(RangeError)
    expect(() => brushLevelToRadius(1.5)).toThrow(RangeError)
    expect(() => brushLevelToRadius(11)).toThrow(RangeError)
  })

  it('expands mathematical hex radii from zero through nine', () => {
    expect(expandHexBrush([{ q: 0, r: 0 }], 0)).toHaveLength(1)
    expect(expandHexBrush([{ q: 0, r: 0 }], 1)).toHaveLength(7)
    expect(expandHexBrush([{ q: 0, r: 0 }], 9)).toHaveLength(271)
  })

  it('interpolates fast pointer samples into a gapless axial line', () => {
    const result = expandHexBrush(
      [
        { q: 0, r: 0 },
        { q: 5, r: -2 }
      ],
      0
    )
    expect(result).toHaveLength(6)
    for (const [index, coordinate] of result.entries()) {
      if (index === 0) continue
      const previous = result[index - 1]!
      expect(
        Math.max(
          Math.abs(coordinate.q - previous.q),
          Math.abs(coordinate.r - previous.r),
          Math.abs(-coordinate.q - coordinate.r - (-previous.q - previous.r))
        )
      ).toBe(1)
    }
  })

  it('fails closed before expanding unsafe or oversized strokes', () => {
    expect(
      expandHexStroke(
        [
          { q: 0, r: 0 },
          { q: Number.MAX_SAFE_INTEGER, r: 0 }
        ],
        0
      )
    ).toBeNull()
    expect(expandHexStroke([{ q: 0, r: 0 }], 11)).toBeNull()
  })
})
