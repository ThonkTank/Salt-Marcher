import { z } from 'zod'

const fingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/)
export const buildChannelSchema = z.enum(['development', 'local', 'release'])

export const buildToolchainSchema = z
  .object({
    node: z.string().min(1),
    pnpm: z.string().min(1),
    electron: z.string().min(1),
    electronVite: z.string().min(1),
    electronBuilder: z.string().min(1),
    platform: z.string().min(1),
    arch: z.string().min(1)
  })
  .strict()
  .readonly()

export const buildInfoSchema = z
  .object({
    channel: buildChannelSchema,
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    dirty: z.boolean(),
    workspaceFingerprint: fingerprintSchema,
    appBuildInputFingerprint: fingerprintSchema,
    builtAt: z.iso.datetime(),
    schemaVersions: z
      .object({
        installation: z.number().int().nonnegative(),
        campaign: z.number().int().nonnegative()
      })
      .strict()
      .readonly(),
    migrationRegistryVersion: z.number().int().nonnegative(),
    toolchain: buildToolchainSchema
  })
  .strict()
  .readonly()

export type BuildChannel = z.infer<typeof buildChannelSchema>
export type BuildToolchain = z.infer<typeof buildToolchainSchema>
export type BuildInfo = z.infer<typeof buildInfoSchema>

export const buildOutputFileSchema = z
  .object({
    path: z.string().min(1),
    bytes: z.number().int().nonnegative(),
    sha256: fingerprintSchema
  })
  .strict()
  .readonly()

export type BuildOutputFile = z.infer<typeof buildOutputFileSchema>

export const buildReceiptSchema = z
  .object({
    formatVersion: z.literal(2),
    build: buildInfoSchema,
    outputHash: fingerprintSchema,
    files: z.array(buildOutputFileSchema).readonly()
  })
  .strict()
  .readonly()

export type BuildReceipt = z.infer<typeof buildReceiptSchema>

export const localArtifactManifestSchema = z
  .object({
    formatVersion: z.literal(2),
    artifactFile: z.string().min(1).max(255),
    artifactSha256: fingerprintSchema,
    receiptSha256: fingerprintSchema,
    receipt: buildReceiptSchema
  })
  .strict()
  .readonly()

export type LocalArtifactManifest = z.infer<typeof localArtifactManifestSchema>

export function shortBuildFingerprint(buildInfo: BuildInfo): string {
  return buildInfo.appBuildInputFingerprint.slice(0, 12)
}
