import { expect, it } from 'vitest'
import { expectedHistoricalMigrationProfile } from '../../scripts/qualification/historical-profile-expectations.js'

const source = { installation: 37, campaign: 34 }
const target = { installation: 42, campaign: 41 }
function fixture() {
  return {
    settings: {
      revision: 1,
      preferences: {
        theme: 'dark',
        sessionLayout: {
          schemaVersion: 2,
          controlPaneWidth: 300,
          scenarioPaneWidth: 264,
          centerTab: 'details'
        }
      }
    },
    registry: {
      campaigns: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Salz' }],
      trashedCampaigns: []
    },
    campaigns: [
      {
        party: { members: [{ level: 3, xp: 975 }] },
        game: {
          session: {
            party: { members: [{ level: 3, xp: 975 }] },
            combat: { round: 2 }
          }
        },
        world: { notes: 'Erhalten' }
      }
    ],
    ownFiles: [{ path: 'notes.txt', base64: 'YWJj' }]
  }
}

it('adds only declared migration facts and preserves unmodeled content and the source', () => {
  const before = fixture()
  const untouched = structuredClone(before)
  const expected = structuredClone(before) as Record<string, unknown>
  expected['settings'] = { revision: 2, preferences: { theme: 'dark' } }
  expected['registry'] = {
    campaigns: [{ ...before.registry.campaigns[0], lastOpenedAt: null }],
    trashedCampaigns: []
  }
  const burden = { shortTrusted: false, longTrusted: false, dailyBudget: 1200 }
  expected['campaigns'] = [
    {
      ...before.campaigns[0],
      party: { members: [{ level: 3, xp: 975, burden }] },
      game: {
        session: {
          party: { members: [{ level: 3, xp: 975, burden }] },
          combat: { round: 2 }
        }
      }
    }
  ]
  expect(expectedHistoricalMigrationProfile(before, source, target)).toEqual(
    expected
  )
  expect(before).toEqual(untouched)
})

it('rejects custom legacy layout values instead of silently accepting their loss', () => {
  const before = fixture()
  before.settings.preferences.sessionLayout.controlPaneWidth = 450
  expect(() =>
    expectedHistoricalMigrationProfile(before, source, target)
  ).toThrow()
})

it('does not normalize unspecified transitions', () => {
  const before = fixture()
  expect(
    expectedHistoricalMigrationProfile(before, source, {
      installation: 39,
      campaign: 34
    })
  ).toBe(before)
  expect(
    expectedHistoricalMigrationProfile(before, source, {
      installation: 43,
      campaign: 42
    })
  ).toBe(before)
})
