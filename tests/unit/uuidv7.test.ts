import { describe, expect, it } from 'vitest'
import { uuidv7 } from '../../src/shared/ids/uuidv7.js'
describe('uuidv7', () => {
  it('creates a UUIDv7-shaped stable-time identifier', () => {
    expect(uuidv7(1_720_000_000_000)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('sorts identifiers by creation order within one millisecond', () => {
    const now = Date.now() + 60_000
    const identifiers = [uuidv7(now), uuidv7(now), uuidv7(now)]

    expect([...identifiers].sort()).toEqual(identifiers)
    expect(new Set(identifiers)).toHaveLength(3)
  })

  it('keeps identifiers monotonic when the clock moves backwards', () => {
    const now = Date.now() + 120_000
    const first = uuidv7(now)
    const second = uuidv7(now - 1)

    expect(first < second).toBe(true)
  })
})
