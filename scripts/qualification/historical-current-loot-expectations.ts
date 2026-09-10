import assert from 'node:assert/strict'
import { z } from 'zod'
import { expectedHistoricalGeneratedLoot } from './historical-loot-expectations.js'

const entry = z.object({ id: z.uuid() }).passthrough()
const source = z
  .object({
    settings: z
      .object({
        revision: z.number().int(),
        preferences: z
          .object({
            theme: z.enum(['light', 'dark']),
            sessionLayout: z
              .object({
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
    party: z
      .object({
        members: z.array(z.object({ level: z.literal(3) }).passthrough())
      })
      .passthrough()
  })
  .passthrough()

export function expectedCurrentHistoricalLoot(raw: unknown) {
  const profile = source.parse(expectedHistoricalGeneratedLoot(raw))
  assert(!Object.hasOwn(profile.registry, 'revision'))
  const entries = (list: z.infer<typeof entry>[]) =>
    list.map((campaign) => {
      assert(!Object.hasOwn(campaign, 'lastOpenedAt'))
      return { ...campaign, lastOpenedAt: null }
    })
  return {
    ...profile,
    settings: {
      revision: profile.settings.revision + 2,
      preferences: { theme: profile.settings.preferences.theme }
    },
    registry: {
      ...profile.registry,
      revision: 0,
      campaigns: entries(profile.registry.campaigns),
      trashedCampaigns: entries(profile.registry.trashedCampaigns)
    },
    party: {
      ...profile.party,
      members: profile.party.members.map((member) => {
        assert(!Object.hasOwn(member, 'burden'))
        return {
          ...member,
          burden: { shortTrusted: false, longTrusted: false, dailyBudget: 1200 }
        }
      })
    }
  }
}
