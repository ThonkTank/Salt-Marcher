import { describe, expect, it } from 'vitest'
import {
  axialDistance,
  axialLine,
  expandWaypoints,
  travelGameSeconds
} from '../../src/core/hex/hex-travel.js'
import {
  coordinates,
  insideRadius,
  parseTileId,
  tileId,
  tileLabel
} from '../../src/core/hex/hex-map-store.js'

describe('hex geometry and travel rules', () => {
  it('generates stable radius coordinates and tile identities', () => {
    expect(coordinates(0)).toEqual([{ q: 0, r: 0 }])
    expect(coordinates(2)).toHaveLength(19)
    expect(insideRadius({ q: 2, r: -1 }, 2)).toBe(true)
    expect(insideRadius({ q: 2, r: 1 }, 2)).toBe(false)
    expect(parseTileId(tileId({ q: -2, r: 1 }))).toEqual({ q: -2, r: 1 })
    expect(tileLabel({ q: -2, r: 1 })).toBe('Hex q=-2, r=1')
  })

  it('expands manual waypoints into deterministic adjacent paths', () => {
    const line = axialLine({ q: 0, r: 0 }, { q: 2, r: -1 })
    expect(line).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: -1 }
    ])
    expect(
      line
        .slice(1)
        .every(
          (coordinate, index) => axialDistance(line[index]!, coordinate) === 1
        )
    ).toBe(true)
    expect(
      expandWaypoints({ q: 0, r: 0 }, [
        { q: 1, r: 0 },
        { q: 1, r: 1 }
      ])
    ).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 1, r: 1 }
    ])
  })

  it('uses the default 3-mile Speed-divided-by-10 rule', () => {
    expect(travelGameSeconds(30, 1)).toBe(3600)
    expect(travelGameSeconds(30, 4)).toBe(14_400)
    expect(travelGameSeconds(0, 1)).toBe(0)
  })
})
