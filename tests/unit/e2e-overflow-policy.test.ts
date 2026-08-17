import { describe, expect, it } from 'vitest'
import { hasImpermissibleLayoutOverflow } from '../e2e/support/e2e-overflow-policy.js'

describe('E2E overflow policy', () => {
  it('accepts contained content and intentional single-line truncation', () => {
    expect(
      hasImpermissibleLayoutOverflow({
        outsideOwnerPixels: 0.4,
        scrollOverflowPixels: 1,
        overflowX: 'visible',
        textOverflow: 'clip',
        whiteSpace: 'normal'
      })
    ).toBe(false)
    expect(
      hasImpermissibleLayoutOverflow({
        outsideOwnerPixels: 12,
        scrollOverflowPixels: 12,
        overflowX: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      })
    ).toBe(false)
  })

  it('rejects clipped controls and unconstrained layout loss', () => {
    expect(
      hasImpermissibleLayoutOverflow({
        outsideOwnerPixels: 12,
        scrollOverflowPixels: 12,
        overflowX: 'hidden',
        textOverflow: 'clip',
        whiteSpace: 'normal'
      })
    ).toBe(true)
    expect(
      hasImpermissibleLayoutOverflow({
        outsideOwnerPixels: 0,
        scrollOverflowPixels: 40,
        overflowX: 'auto',
        textOverflow: 'clip',
        whiteSpace: 'normal'
      })
    ).toBe(true)
  })
})
