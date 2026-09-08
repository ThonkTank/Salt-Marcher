import { describe, expect, it } from 'vitest'
import { installedProfileReadbacks } from '../../scripts/installed-profile-readbacks.js'

describe('installed profile readback', () => {
  it.each([
    {
      name: 'fresh installation',
      count: 0,
      active: null,
      exists: false,
      valid: true
    },
    {
      name: 'selected campaign',
      count: 2,
      active: 'campaign',
      exists: true,
      valid: true
    },
    {
      name: 'dangling selection in empty profile',
      count: 0,
      active: 'missing',
      exists: false,
      valid: false
    },
    {
      name: 'missing selected campaign',
      count: 1,
      active: 'missing',
      exists: false,
      valid: false
    },
    {
      name: 'missing selection in populated profile',
      count: 1,
      active: null,
      exists: false,
      valid: false
    }
  ])('$name', ({ count, active, exists, valid }) => {
    expect(
      installedProfileReadbacks(count, active, exists).every(
        ({ passed }) => passed
      )
    ).toBe(valid)
  })
})
