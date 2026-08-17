import { z } from 'zod'

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const externalKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._:/-]*$/)

export const campaignImportSectionSchema = z.enum([
  'party',
  'locations',
  'factions',
  'npcs'
])

const resolvedTextSchema = z
  .object({
    source: z.string().trim().min(1).max(200),
    resolved: z.string().trim().min(1).max(200)
  })
  .strict()

const importPartyCharacterSchema = z
  .object({
    externalKey: externalKeySchema,
    name: z.string().trim().min(1).max(100),
    playerName: z.string().trim().max(100).nullable(),
    species: resolvedTextSchema.nullable(),
    characterClass: z.string().trim().max(100).nullable(),
    languages: z.array(resolvedTextSchema).max(100),
    level: z.number().int().min(1).max(20).nullable(),
    passivePerception: z.number().int().min(0).max(99).nullable(),
    passiveInvestigation: z.number().int().min(0).max(99).nullable(),
    passiveInsight: z.number().int().min(0).max(99).nullable(),
    armorClass: z.number().int().min(0).max(99).nullable(),
    movementSpeedFeet: z.number().int().min(0).max(999).nullable()
  })
  .strict()

const importLocationSchema = z
  .object({
    externalKey: externalKeySchema,
    displayName: z.string().trim().min(1).max(100),
    tags: z.array(z.string().trim().min(1).max(100)).max(100),
    readAloud: z.string().trim().max(20_000),
    notes: z.string().trim().max(20_000)
  })
  .strict()

const importFactionSchema = z
  .object({
    externalKey: externalKeySchema,
    displayName: z.string().trim().min(1).max(100),
    notes: z.string().trim().max(20_000),
    disposition: z.number().int().min(-50).max(50)
  })
  .strict()

const importNpcSchema = z
  .object({
    externalKey: externalKeySchema,
    displayName: z.string().trim().min(1).max(100),
    creature: z
      .object({
        source: z.string().trim().min(1).max(300),
        resolvedId: z.string().trim().min(1).max(300)
      })
      .strict(),
    lifecycle: z.enum(['active', 'defeated']),
    appearance: z.string().trim().max(20_000),
    behavior: z.string().trim().max(20_000),
    history: z.string().trim().max(20_000),
    notes: z.string().trim().max(20_000),
    dispositionModifier: z.number().int().min(-50).max(50),
    factionExternalKey: externalKeySchema.nullable(),
    locationExternalKey: externalKeySchema.nullable()
  })
  .strict()

export const campaignImportResolutionSchema = z
  .object({
    path: z.string().min(1).max(500),
    kind: z.enum(['species', 'language', 'statblock', 'location', 'faction']),
    sourceValue: z.string().max(300),
    resolvedValue: z.string().max(300),
    reasonCode: z.string().regex(/^[a-z][a-z0-9._-]{0,79}$/)
  })
  .strict()

export const campaignImportBundleSchema = z
  .object({
    bundleVersion: z.literal(1),
    source: z
      .object({
        id: externalKeySchema,
        revision: z.number().int().nonnegative(),
        exportedAt: z.iso.datetime(),
        exportHash: sha256Schema,
        sections: z
          .array(campaignImportSectionSchema)
          .length(4)
          .refine((values) => new Set(values).size === values.length)
      })
      .strict(),
    campaign: z
      .object({
        externalKey: externalKeySchema,
        name: z.string().trim().min(1).max(100)
      })
      .strict(),
    party: z.array(importPartyCharacterSchema).max(1_000),
    locations: z.array(importLocationSchema).max(10_000),
    factions: z.array(importFactionSchema).max(10_000),
    npcs: z.array(importNpcSchema).max(100_000),
    resolutions: z
      .array(campaignImportResolutionSchema)
      .max(100_000)
      .refine(
        (values) =>
          new Set(values.map((value) => value.path)).size === values.length,
        { message: 'Resolution paths must be unique' }
      )
  })
  .strict()
  .readonly()

export const campaignImportConflictCodeSchema = z.enum([
  'invalid_bundle',
  'export_hash_mismatch',
  'duplicate_external_key',
  'duplicate_display_name',
  'unknown_statblock',
  'unknown_location',
  'unknown_faction',
  'missing_resolution',
  'source_revision_regressed',
  'source_revision_reused'
])

export const campaignImportConflictSchema = z
  .object({
    code: campaignImportConflictCodeSchema,
    path: z.string().max(500),
    sourcePath: z.string().max(500),
    parameters: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
  })
  .strict()

export const campaignImportSummarySchema = z
  .object({
    party: z.number().int().nonnegative(),
    locations: z.number().int().nonnegative(),
    factions: z.number().int().nonnegative(),
    npcs: z.number().int().nonnegative()
  })
  .strict()

export const campaignImportReportSchema = z
  .object({
    valid: z.boolean(),
    sourceId: z.string().max(160).nullable(),
    sourceRevision: z.number().int().nonnegative().nullable(),
    exportHash: sha256Schema.nullable(),
    previous: z
      .object({
        revision: z.number().int().nonnegative(),
        exportHash: sha256Schema
      })
      .strict()
      .nullable(),
    delta: z.enum([
      'new',
      'unchanged',
      'changed',
      'regressed',
      'reused-revision'
    ]),
    changedSections: z.array(campaignImportSectionSchema),
    summary: campaignImportSummarySchema,
    conflicts: z.array(campaignImportConflictSchema)
  })
  .strict()

export const campaignImportApplyInputSchema = z
  .object({ bundle: campaignImportBundleSchema })
  .strict()

export const campaignImportValidateInputSchema = z
  .object({ bundle: z.unknown() })
  .strict()

export const campaignImportApplyResultSchema = z
  .object({
    status: z.enum(['applied', 'unchanged']),
    campaignId: z.uuid(),
    sourceId: externalKeySchema,
    sourceRevision: z.number().int().nonnegative(),
    exportHash: sha256Schema,
    summary: campaignImportSummarySchema
  })
  .strict()

export type CampaignImportBundle = Readonly<
  z.infer<typeof campaignImportBundleSchema>
>
export type CampaignImportReport = Readonly<
  z.infer<typeof campaignImportReportSchema>
>
export type CampaignImportApplyResult = Readonly<
  z.infer<typeof campaignImportApplyResultSchema>
>
export type CampaignImportSection = z.infer<typeof campaignImportSectionSchema>
