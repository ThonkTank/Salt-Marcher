import { z } from 'zod'

/** Declared by packaged code, never inferred from an arbitrary profile marker. */
export const profileAccessProtocolSchema = z
  .object({
    formatVersion: z.literal(1),
    locking: z.literal('canonical-profile-v1'),
    scope: z.literal('complete-profile'),
    browserStorage: z.literal('outside-profile')
  })
  .strict()
