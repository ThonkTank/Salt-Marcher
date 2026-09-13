import { describe, expect, it } from 'vitest'
import {
  iterationAreas,
  iterationIdentity,
  parseIterationArguments
} from '../../scripts/iteration-workflow.js'

describe('owner iteration workflow', () => {
  it('keeps the supported GM feedback areas deliberately small', () => {
    expect(iterationAreas).toEqual([
      'characters',
      'encounter',
      'combat',
      'loot'
    ])
  })

  it('accepts one area and the optional check-only mode', () => {
    expect(parseIterationArguments(['encounter'])).toEqual({
      area: 'encounter',
      checkOnly: false
    })
    expect(parseIterationArguments(['loot', '--check-only'])).toEqual({
      area: 'loot',
      checkOnly: true
    })
    expect(() => parseIterationArguments([])).toThrow('Usage: pnpm iterate')
    expect(() => parseIterationArguments(['maps'])).toThrow(
      'Usage: pnpm iterate'
    )
  })

  it('shows the exact commit prefix and whether the source is dirty', () => {
    const commit = '0123456789abcdef0123456789abcdef01234567'
    expect(iterationIdentity('combat', commit, false)).toBe(
      'combat@0123456789ab'
    )
    expect(iterationIdentity('combat', commit, true)).toBe(
      'combat@0123456789ab+dirty'
    )
    expect(() => iterationIdentity('combat', 'short', false)).toThrow(
      'full lowercase Git commit'
    )
  })
})
