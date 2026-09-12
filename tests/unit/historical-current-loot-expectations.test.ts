import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { z } from 'zod'
import { expectedCurrentHistoricalLoot } from '../../scripts/qualification/historical-current-loot-expectations.js'
const fixture = () =>
  z
    .object({
      settings: z
        .object({
          revision: z.number(),
          preferences: z
            .object({
              theme: z.string(),
              sessionLayout: z
                .object({ controlPaneWidth: z.number() })
                .passthrough()
            })
            .passthrough()
        })
        .passthrough(),
      registry: z.record(z.string(), z.unknown())
    })
    .passthrough()
    .parse(
      JSON.parse(
        readFileSync(
          'tests/fixtures/historical-loot30/source-profile.json',
          'utf8'
        )
      )
    )
it('preserves the source and applies only the known current profile migrations', () => {
  const source = fixture()
  const before = structuredClone(source)
  const expected = expectedCurrentHistoricalLoot(source)
  expect(source).toEqual(before)
  expect(expected.settings).toEqual({
    revision: source.settings.revision + 2,
    preferences: { theme: 'dark' }
  })
  expect(expected.registry.revision).toBe(0)
  expect(
    expected.registry.campaigns.every((entry) => entry.lastOpenedAt === null)
  ).toBe(true)
  expect(expected.party.members).toHaveLength(5)
  for (const member of expected.party.members)
    expect(member.burden).toEqual({
      shortTrusted: false,
      longTrusted: false,
      dailyBudget: 1200
    })
})
it('rejects custom legacy layout values instead of dropping them', () => {
  const source = fixture()
  source.settings.preferences.sessionLayout.controlPaneWidth = 450
  expect(() => expectedCurrentHistoricalLoot(source)).toThrow()
})
it('rejects a cohort which already contains registry revision facts', () => {
  const source = fixture()
  source.registry['revision'] = 4
  expect(() => expectedCurrentHistoricalLoot(source)).toThrow()
})
