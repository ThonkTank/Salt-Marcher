import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { axialCoordinateSchema } from '../../src/shared/contracts/hex.js'
import type { CurrentFormatCampaignManifest } from './current-format-campaign-manifest.js'
import type { CurrentFormatEconomyFixture } from './current-format-economy-fixture.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import type { CurrentFormatPreparationFixture } from './current-format-preparation-fixture.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'

export const currentFormatCompletionRegistrations = Object.freeze([
  'world-location-save-journal'
] as const)

const campaignSchema = z
  .object({
    role: z.enum(['A', 'B']),
    materialization: z
      .object({
        commandId: z.uuid(),
        locationSemanticKey: z.string().regex(/^location:[a-z0-9-]+$/),
        locationName: z.string().trim().min(1).max(100),
        locationTags: z.array(z.string().trim().min(1).max(40)).min(1),
        locationNotes: z.string().trim().min(1),
        placementCoordinate: axialCoordinateSchema
      })
      .strict(),
    expected: z
      .object({
        locationRevision: z.number().int().positive(),
        mapContentRevision: z.number().int().positive(),
        semanticSha256: z.string().regex(/^[0-9a-f]{64}$/)
      })
      .strict()
  })
  .strict()

export const currentFormatCompletionFixtureSchema = z
  .object({
    version: z.literal(1),
    identity: z.literal('frontend-robustness-current-format-completion-v1'),
    economyFixtureIdentity: z.literal(
      'frontend-robustness-current-format-economy-v1'
    ),
    qualificationClaim: z.literal(
      'complete-fr2f2c-current-format-owner-coverage-not-rp-r-or-rp-l'
    ),
    coveredCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatCompletionRegistrations.length),
    campaigns: z.array(campaignSchema).length(2)
  })
  .strict()
  .superRefine((fixture, context) => {
    if (fixture.campaigns.map(({ role }) => role).join(',') !== 'A,B')
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Completion fixture Campaign roles must be exactly A then B.'
      })
    const identities = fixture.campaigns.flatMap(({ materialization }) => [
      materialization.commandId,
      materialization.locationSemanticKey,
      materialization.locationName
    ])
    if (new Set(identities).size !== identities.length)
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Completion fixture identities must be unique.'
      })
  })

export type CurrentFormatCompletionFixture = Readonly<
  z.infer<typeof currentFormatCompletionFixtureSchema>
>
export type CurrentFormatCompletionCampaign = Readonly<
  CurrentFormatCompletionFixture['campaigns'][number]
>

export type CurrentFormatPrimaryCoverageCohort = Readonly<{
  identity: string
  values: readonly string[]
}>

export function loadCurrentFormatCompletionFixture(
  path: string,
  manifest: CurrentFormatCampaignManifest,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture
): CurrentFormatCompletionFixture {
  return validateCurrentFormatCompletionFixture(
    JSON.parse(readFileSync(path, 'utf8')),
    manifest,
    rootFixture,
    liveFixture,
    spatialFixture,
    preparationFixture,
    economyFixture
  )
}

export function validateCurrentFormatCompletionFixture(
  raw: unknown,
  manifest: CurrentFormatCampaignManifest,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture
): CurrentFormatCompletionFixture {
  const fixture = currentFormatCompletionFixtureSchema.parse(raw)
  if (fixture.economyFixtureIdentity !== economyFixture.identity)
    throw new Error('Current-format completion economy identity is stale.')
  assertExact(
    fixture.coveredCampaignRegistrations,
    currentFormatCompletionRegistrations,
    'completion Campaign coverage'
  )
  const owner = manifest.campaignOwners.find(
    ({ registration }) =>
      registration === currentFormatCompletionRegistrations[0]
  )
  if (
    owner?.stateClass !== 'reconciliation' ||
    owner.disposition !== 'reconciliation-journey'
  )
    throw new Error(
      'Current-format completion owner is not a reconciliation journey.'
    )

  assertExactPrimaryCoverage(
    manifest.campaignOwners.map(({ registration }) => registration),
    [
      {
        identity: rootFixture.identity,
        values: rootFixture.coveredCampaignRegistrations
      },
      {
        identity: liveFixture.identity,
        values: liveFixture.coveredCampaignRegistrations
      },
      {
        identity: spatialFixture.identity,
        values: spatialFixture.coveredCampaignRegistrations
      },
      {
        identity: preparationFixture.identity,
        values: preparationFixture.coveredCampaignRegistrations
      },
      {
        identity: economyFixture.identity,
        values: economyFixture.coveredCampaignRegistrations
      },
      {
        identity: fixture.identity,
        values: fixture.coveredCampaignRegistrations
      }
    ],
    'Campaign registrations'
  )
  assertExactPrimaryCoverage(
    manifest.installationDependencies.map(({ authority }) => authority),
    [
      {
        identity: rootFixture.identity,
        values: rootFixture.coveredInstallationAuthorities
      },
      {
        identity: preparationFixture.identity,
        values: preparationFixture.coveredInstallationAuthorities
      },
      {
        identity: economyFixture.identity,
        values: economyFixture.coveredInstallationAuthorities
      }
    ],
    'installation authorities'
  )

  for (const campaign of fixture.campaigns) {
    const economy = economyFixture.campaigns.find(
      ({ role }) => role === campaign.role
    )
    const spatial = spatialFixture.campaigns.find(
      ({ role }) => role === campaign.role
    )
    if (!economy || !spatial)
      throw new Error(
        `Current-format completion Campaign ${campaign.role} has no economy/spatial fixture.`
      )
    if (
      campaign.expected.locationRevision !==
        economy.expected.locationRevision + 1 ||
      campaign.expected.mapContentRevision !==
        spatial.expected.mapContentRevision + 1
    )
      throw new Error(
        `Current-format completion Campaign ${campaign.role} revision sentinel is stale.`
      )
    const coordinate = campaign.materialization.placementCoordinate
    if (
      !spatial.materialization.routeCoordinates.some(
        ({ q, r }) => q === coordinate.q && r === coordinate.r
      ) ||
      (spatial.materialization.placedLocationCoordinate.q === coordinate.q &&
        spatial.materialization.placedLocationCoordinate.r === coordinate.r)
    )
      throw new Error(
        `Current-format completion Campaign ${campaign.role} placement target is not a free authored route tile.`
      )
  }
  return fixture
}

export function assertExactPrimaryCoverage(
  expected: readonly string[],
  cohorts: readonly CurrentFormatPrimaryCoverageCohort[],
  label: string
): void {
  const expectedSet = new Set(expected)
  for (const cohort of cohorts)
    for (const value of cohort.values)
      if (!expectedSet.has(value))
        throw new Error(
          `Current-format ${label} has unknown primary ${value} in ${cohort.identity}.`
        )
  for (const value of expected) {
    const owners = cohorts.filter((cohort) => cohort.values.includes(value))
    if (owners.length !== 1)
      throw new Error(
        `Current-format ${label} primary ${value} has ${owners.length} dispositions; expected exactly one.`
      )
  }
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
    throw new Error(`Current-format ${label} does not match.`)
}
