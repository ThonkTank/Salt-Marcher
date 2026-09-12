import { z } from 'zod'
import { withPartyQuickFieldDefault } from './historical-settings-expectation.js'

export const partyHistoryScenarioSchema = z.enum([
  'from-41',
  'from-candidate-42',
  'from-main-42',
  'same-schema'
])
export function partyHistoryScenario(name: string) {
  const scenario = partyHistoryScenarioSchema.parse(name)
  const baselines = {
    'from-41': { installation: 42, campaign: 41 },
    'from-candidate-42': { installation: 42, campaign: 42 },
    'from-main-42': { installation: 43, campaign: 42 },
    'same-schema': { installation: 43, campaign: 43 }
  } as const
  return {
    baseline: baselines[scenario],
    target: { installation: 43, campaign: 43 }
  }
}

/** Literal defaults introduced by Main baf2411f0; preserve every existing value. */
export function withPartyHistoryDefaults(profile: unknown): unknown {
  const member = z
    .object({ burden: z.record(z.string(), z.unknown()) })
    .passthrough()
  const party = z.object({ members: z.array(member) }).passthrough()
  const result = z
    .object({
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
    .parse(withPartyQuickFieldDefault(profile))
  for (const campaign of result.campaigns) {
    for (const roster of [campaign.party, campaign.game.session.party]) {
      for (const character of roster.members) {
        for (const [key, value] of Object.entries({
          completedShortRestSections: 0,
          sectionStartXp: 0,
          sectionsTrusted: false
        })) {
          if (!Object.hasOwn(character.burden, key))
            character.burden[key] = value
        }
      }
    }
  }
  return result
}
