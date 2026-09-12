import { expect, it } from 'vitest'
import {
  partyHistoryScenario,
  withPartyHistoryDefaults
} from '../../scripts/qualification/historical-party-history-scenario.js'
it.each([
  ['from-41', 42, 41],
  ['from-candidate-42', 42, 42],
  ['from-main-42', 43, 42],
  ['same-schema', 43, 43]
] as const)(
  'pins %s to explicit original schemas',
  (name, installation, campaign) => {
    expect(partyHistoryScenario(name)).toEqual({
      baseline: { installation, campaign },
      target: { installation: 43, campaign: 43 }
    })
  }
)
it('rejects an unknown scenario', () =>
  expect(() => partyHistoryScenario('latest')).toThrow())
it('adds only known defaults, preserves stored values and leaves the source untouched', () => {
  const old = {
    id: 'old',
    burden: {
      shortTrusted: true,
      longTrusted: false,
      dailyBudget: 1200,
      own: 'retained'
    }
  }
  const current = {
    id: 'current',
    burden: {
      ...old.burden,
      completedShortRestSections: 2,
      sectionStartXp: 975,
      sectionsTrusted: true
    }
  }
  const source = {
    settings: { preferences: { theme: 'dark', partyQuickFields: [] } },
    campaigns: [
      {
        party: { members: [old, current] },
        game: { session: { party: { members: [old, current] } } },
        own: 'campaign'
      }
    ],
    ownFiles: ['kept']
  }
  const before = structuredClone(source)
  const added = {
    ...old,
    burden: {
      ...old.burden,
      completedShortRestSections: 0,
      sectionStartXp: 0,
      sectionsTrusted: false
    }
  }
  const expected = {
    ...source,
    campaigns: [
      {
        ...source.campaigns[0],
        party: { members: [added, current] },
        game: { session: { party: { members: [added, current] } } }
      }
    ]
  }
  expect(withPartyHistoryDefaults(source)).toEqual(expected)
  expect(source).toEqual(before)
  expect(withPartyHistoryDefaults(expected)).toEqual(expected)
})
