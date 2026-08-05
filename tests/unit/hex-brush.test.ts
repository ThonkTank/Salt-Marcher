import { describe, expect, it } from 'vitest'
import { expandHexBrush } from '../../src/renderer/features/hex/hex-brush.js'
import { expandHexStroke } from '../../src/shared/hex/axial-geometry.js'

describe('hex brush geometry', () => {
  it('expands mathematical hex radii from zero through ten', () => {
    expect(expandHexBrush([{ q: 0, r: 0 }], 0)).toHaveLength(1)
    expect(expandHexBrush([{ q: 0, r: 0 }], 1)).toHaveLength(7)
    expect(expandHexBrush([{ q: 0, r: 0 }], 10)).toHaveLength(331)
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
