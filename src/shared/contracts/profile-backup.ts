import { z } from 'zod'

/** Historical campaign-data backup envelope; never a raw-profile marker. */
export const profileBackupSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    version: z.string().min(1),
    restorable: z.boolean().default(true),
    files: z.array(
      z
        .object({
          path: z
            .string()
            .min(1)
            .refine(
              (path) =>
                !path.startsWith('/') &&
                path
                  .split('/')
                  .every((part) => part !== '' && part !== '.' && part !== '..')
            ),
          bytes: z.number().int().nonnegative(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/)
        })
        .strict()
    )
  })
  .strict()
