import { describe, expect, it } from 'vitest'
import { uuidv7 } from '../../src/shared/ids/uuidv7.js'
describe('uuidv7', () => {
  it('creates a UUIDv7-shaped stable-time identifier', () => {
    expect(uuidv7(1_720_000_000_000)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
