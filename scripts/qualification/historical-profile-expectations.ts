import assert from 'node:assert/strict'
import { z } from 'zod'

const member = z.object({ level: z.literal(3) }).passthrough()
const party = z.object({ members: z.array(member) }).passthrough()
const entry = z.object({ id: z.uuid() }).passthrough()
const legacyProfile = z
  .object({
    settings: z
      .object({
        revision: z.number().int(),
        preferences: z
          .object({
            theme: z.enum(['light', 'dark']),
            sessionLayout: z
              .object({
                schemaVersion: z.literal(2),
                controlPaneWidth: z.literal(300),
                scenarioPaneWidth: z.literal(264),
                centerTab: z.literal('details')
              })
              .strict()
          })
          .strict()
      })
      .strict(),
    registry: z
      .object({ campaigns: z.array(entry), trashedCampaigns: z.array(entry) })
      .passthrough(),
    campaigns: z.array(
      z
        .object({
          party,
          game: z
            .object({ session: z.object({ party }).passthrough() })
            .passthrough()
        })
        .passthrough()
    )
  })
  .passthrough()

/** Explicit oracle for this historical cohort; never discard unknown result fields. */
export function expectedHistoricalMigrationProfile(
  before: unknown,
  source: { installation: number; campaign: number },
  target: { installation: number; campaign: number }
): unknown {
  if (
    target.installation !== 42 ||
    target.campaign !== 41 ||
    source.installation < 37 ||
    source.installation > 39 ||
    source.campaign !== 34
  )
    return before
  const expected = legacyProfile.parse(structuredClone(before))
  for (const campaign of expected.campaigns) {
    for (const roster of [campaign.party, campaign.game.session.party]) {
      for (const character of roster.members) {
        assert(
          !Object.hasOwn(character, 'burden'),
          'Legacy cohort already has burden facts'
        )
        character['burden'] = {
          shortTrusted: false,
          longTrusted: false,
          dailyBudget: 1200
        }
      }
    }
  }
  for (const campaign of [
    ...expected.registry.campaigns,
    ...expected.registry.trashedCampaigns
  ]) {
    assert(
      !Object.hasOwn(campaign, 'lastOpenedAt'),
      'Legacy cohort already has last-opened facts'
    )
    campaign['lastOpenedAt'] = null
  }
  return {
    ...expected,
    settings: {
      revision: expected.settings.revision + 1,
      preferences: { theme: expected.settings.preferences.theme }
    }
  }
}
