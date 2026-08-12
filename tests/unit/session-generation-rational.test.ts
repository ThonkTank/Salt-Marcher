import { describe, expect, it } from 'vitest'
import {
  decimal,
  floor,
  roundHalfUp
} from '../../src/core/session-generation/rational.js'

describe('session generation exact rational arithmetic', () => {
  it('parses catalog scientific notation without binary floating-point loss', () => {
    expect(decimal('8.333333333333334E-4')).toEqual({
      numerator: 4_166_666_666_666_667n,
      denominator: 5_000_000_000_000_000_000n
    })
    expect(decimal('1.20e2')).toEqual({ numerator: 120n, denominator: 1n })
  })

  it('uses explicit half-up and mathematical-floor semantics for both signs', () => {
    expect(roundHalfUp(decimal('1.5'))).toBe(2)
    expect(roundHalfUp(decimal('-1.5'))).toBe(-2)
    expect(floor(decimal('-1.01'))).toBe(-2)
    expect(floor(decimal('1.99'))).toBe(1)
  })
})
