import { z } from 'zod'

export const releaseRepository = 'ThonkTank/Salt-Marcher'
export const releaseVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
export const releaseManifestSchema = z
  .object({
    formatVersion: z.literal(1),
    repository: z.literal(releaseRepository),
    version: releaseVersionSchema,
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    platform: z.literal('linux'),
    arch: z.literal('x64'),
    schemaVersions: z
      .object({
        installation: z.number().int().positive(),
        campaign: z.number().int().positive()
      })
      .strict(),
    artifact: z
      .object({
        name: z.string().regex(/^SaltMarcher-[0-9.]+-x64\.AppImage$/),
        bytes: z
          .number()
          .int()
          .positive()
          .max(2 ** 31),
        sha256: z.string().regex(/^[a-f0-9]{64}$/)
      })
      .strict()
  })
  .strict()
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>
export const backupSummarySchema = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    version: z.string().min(1),
    bytes: z.number().nonnegative(),
    valid: z.boolean()
  })
  .strict()
export const releaseStatusSchema = z
  .object({
    enabled: z.boolean(),
    installed: z.boolean(),
    currentVersion: z.string(),
    phase: z.enum([
      'idle',
      'checking',
      'available',
      'downloading',
      'downloaded',
      'maintenance',
      'error'
    ]),
    availableVersion: z.string().nullable(),
    notes: z.string(),
    progress: z.number().min(0).max(1),
    message: z.string()
  })
  .strict()
export type ReleaseStatus = z.infer<typeof releaseStatusSchema>
export function newerRelease(candidate: string, current: string): boolean {
  const left = releaseVersionSchema.parse(candidate).split('.').map(Number)
  const right = releaseVersionSchema.parse(current).split('.').map(Number)
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index]! > right[index]!
  }
  return false
}
