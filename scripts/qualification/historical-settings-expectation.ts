import { z } from 'zod'

/** Explicit expectation for the additive default introduced by 0f2bdd2fa. */
export function withPartyQuickFieldDefault(profile: unknown): unknown {
  const result = z
    .object({
      settings: z
        .object({
          preferences: z.record(z.string(), z.unknown())
        })
        .passthrough()
    })
    .passthrough()
    .parse(structuredClone(profile))
  if (!Object.hasOwn(result.settings.preferences, 'partyQuickFields'))
    result.settings.preferences['partyQuickFields'] = [
      'armorClass',
      'passivePerception'
    ]
  return result
}
