import { readFileSync } from 'node:fs'
import { z } from 'zod'
import type { CurrentFormatCampaignManifest } from './current-format-campaign-manifest.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'

export const currentFormatPreparationRegistrations = Object.freeze([
  'campaign-rules',
  'encounter-plans',
  'encounter-tables',
  'session-generation',
  'session-planner'
] as const)

export const currentFormatPreparationInstallationAuthorities = Object.freeze([
  'installation.generator-presets',
  'installation.encounter-tables'
] as const)

const commandIdsSchema = z
  .object({
    createPreset: z.uuid(),
    assignPreset: z.uuid(),
    updateRules: z.uuid(),
    createCampaignEncounterTable: z.uuid(),
    preparationOperation: z.uuid()
  })
  .strict()

const campaignSchema = z
  .object({
    role: z.enum(['A', 'B']),
    materialization: z
      .object({
        presetSemanticKey: z.string().regex(/^generator-preset:[a-z0-9-]+$/),
        presetName: z.string().trim().min(1).max(100),
        referencedLocationExternalKey: z.string().min(1),
        commandIds: commandIdsSchema,
        rewardXpBasis: z.literal('adjusted'),
        campaignEncounterTableName: z.string().trim().min(1).max(100),
        encounterCreatureId: z.string().min(1),
        seed: z.number().int().nonnegative(),
        adventureDayFraction: z.string().regex(/^0\.[1-9]$/),
        encounterCount: z.number().int().positive()
      })
      .strict(),
    expected: z
      .object({
        rulesRevision: z.literal(1),
        locationRevision: z.number().int().positive(),
        campaignEncounterTableRevision: z.literal(1),
        plannerRevision: z.literal(2),
        preparationStatus: z.literal('succeeded'),
        generatedRunKind: z.literal('session'),
        encounterPlanCount: z.number().int().positive(),
        generatedRewardCount: z.number().int().nonnegative(),
        semanticSha256: z.string().regex(/^[0-9a-f]{64}$/)
      })
      .strict()
  })
  .strict()

export const currentFormatPreparationFixtureSchema = z
  .object({
    version: z.literal(1),
    identity: z.literal('frontend-robustness-current-format-preparation-v1'),
    spatialFixtureIdentity: z.literal(
      'frontend-robustness-current-format-spatial-v1'
    ),
    qualificationClaim: z.literal(
      'partial-fr2f2c1-preparation-cohort-not-complete-current-format'
    ),
    coveredCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatPreparationRegistrations.length),
    coveredInstallationAuthorities: z
      .array(z.string())
      .length(currentFormatPreparationInstallationAuthorities.length),
    installation: z
      .object({
        sharedEncounterTableCommandId: z.uuid(),
        sharedEncounterTableName: z.string().trim().min(1).max(100),
        sharedEncounterCreatureId: z.string().min(1),
        expectedPresetRegistryRevision: z.literal(4),
        expectedEncounterTableRevision: z.literal(1)
      })
      .strict(),
    campaigns: z.array(campaignSchema).length(2)
  })
  .strict()
  .superRefine((fixture, context) => {
    if (fixture.campaigns.map(({ role }) => role).join(',') !== 'A,B')
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Preparation fixture Campaign roles must be exactly A then B.'
      })
    unique(
      fixture.campaigns.map(
        ({ materialization }) => materialization.presetSemanticKey
      ),
      ['campaigns'],
      context
    )
    unique(
      fixture.campaigns.map(
        ({ materialization }) => materialization.presetName
      ),
      ['campaigns'],
      context
    )
    unique(
      [
        fixture.installation.sharedEncounterTableCommandId,
        ...fixture.campaigns.flatMap(({ materialization }) =>
          Object.values(materialization.commandIds)
        )
      ],
      ['campaigns'],
      context
    )
  })

export type CurrentFormatPreparationFixture = Readonly<
  z.infer<typeof currentFormatPreparationFixtureSchema>
>
export type CurrentFormatPreparationCampaign = Readonly<
  CurrentFormatPreparationFixture['campaigns'][number]
>

export function loadCurrentFormatPreparationFixture(
  path: string,
  manifest: CurrentFormatCampaignManifest,
  spatialFixture: CurrentFormatSpatialFixture
): CurrentFormatPreparationFixture {
  return validateCurrentFormatPreparationFixture(
    JSON.parse(readFileSync(path, 'utf8')),
    manifest,
    spatialFixture
  )
}

export function validateCurrentFormatPreparationFixture(
  raw: unknown,
  manifest: CurrentFormatCampaignManifest,
  spatialFixture: CurrentFormatSpatialFixture
): CurrentFormatPreparationFixture {
  const fixture = currentFormatPreparationFixtureSchema.parse(raw)
  assertExact(
    fixture.coveredCampaignRegistrations,
    currentFormatPreparationRegistrations,
    'Campaign coverage'
  )
  assertExact(
    fixture.coveredInstallationAuthorities,
    currentFormatPreparationInstallationAuthorities,
    'installation coverage'
  )
  if (fixture.spatialFixtureIdentity !== spatialFixture.identity)
    throw new Error(
      'Current-format preparation fixture spatial identity is stale.'
    )

  for (const campaign of fixture.campaigns) {
    const spatial = spatialFixture.campaigns.find(
      ({ role }) => role === campaign.role
    )
    if (
      campaign.materialization.referencedLocationExternalKey !==
      spatial?.materialization.placedLocationExternalKey
    )
      throw new Error(
        `Current-format preparation Campaign ${campaign.role} must reference its placed spatial Location.`
      )
  }

  const owners = new Map(
    manifest.campaignOwners.map((owner) => [owner.registration, owner])
  )
  for (const registration of currentFormatPreparationRegistrations) {
    const owner = owners.get(registration)
    if (!owner)
      throw new Error(
        `Current-format preparation fixture references unknown owner ${registration}.`
      )
    if (owner.disposition !== 'fixture-load')
      throw new Error(
        `Current-format preparation owner ${registration} is not fixture-load.`
      )
  }
  const covered = new Set<string>(currentFormatPreparationRegistrations)
  assertExact(
    manifest.campaignOwners
      .map(({ registration }) => registration)
      .filter((registration) => covered.has(registration)),
    currentFormatPreparationRegistrations,
    'Campaign owner order'
  )
  const dependencies = new Map(
    manifest.installationDependencies.map((dependency) => [
      dependency.authority,
      dependency
    ])
  )
  for (const authority of currentFormatPreparationInstallationAuthorities) {
    const dependency = dependencies.get(authority)
    if (!dependency)
      throw new Error(
        `Current-format preparation fixture references unknown installation dependency ${authority}.`
      )
    if (dependency.disposition !== 'shared-dependency')
      throw new Error(
        `Current-format preparation installation dependency ${authority} is not shared-dependency.`
      )
  }
  return fixture
}

function assertExact(
  actual: readonly string[],
  expected: readonly string[],
  label: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((entry, index) => entry !== expected[index])
  )
    throw new Error(`Current-format preparation ${label} does not match.`)
}

function unique(
  values: readonly string[],
  path: readonly (string | number)[],
  context: z.RefinementCtx
): void {
  if (new Set(values).size === values.length) return
  context.addIssue({
    code: 'custom',
    path: [...path],
    message: 'Preparation fixture identities must be unique.'
  })
}
