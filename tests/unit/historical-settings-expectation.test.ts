import { describe, expect, it } from 'vitest'
import { withPartyQuickFieldDefault } from '../../scripts/qualification/historical-settings-expectation.js'

describe('explicit historical settings expectation', () => {
  it('adds only the documented default without changing the source', () => {
    const source = {
      settings: { revision: 4, preferences: { theme: 'dark' } },
      campaigns: [{ state: 'playing' }],
      own: { file: 'content' }
    }
    const before = structuredClone(source)
    expect(withPartyQuickFieldDefault(source)).toEqual({
      ...source,
      settings: {
        ...source.settings,
        preferences: {
          theme: 'dark',
          partyQuickFields: ['armorClass', 'passivePerception']
        }
      }
    })
    expect(source).toEqual(before)
  })
  it.each([[], ['armorClass'], ['passivePerception', 'armorClass']])(
    'preserves configured fields %j',
    (...fields) => {
      const source = {
        settings: { preferences: { theme: 'light', partyQuickFields: fields } }
      }
      expect(withPartyQuickFieldDefault(source)).toEqual(source)
    }
  )
})
