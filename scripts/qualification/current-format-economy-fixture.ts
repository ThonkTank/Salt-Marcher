import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { itemDefinitionSchema } from '../../src/shared/contracts/loot.js'
import { sessionLayoutPreferenceSchema } from '../../src/shared/contracts/session-layout.js'
import type { CurrentFormatCampaignManifest } from './current-format-campaign-manifest.js'
import type { CurrentFormatPreparationFixture } from './current-format-preparation-fixture.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'

export const currentFormatEconomyRegistrations = Object.freeze([
  'legacy-items',
  'loot',
  'character-loot'
] as const)

export const currentFormatEconomyInstallationAuthorities = Object.freeze([
  'installation.biomes-and-symbols',
  'installation.session-layout'
] as const)

export const currentFormatEconomyExtendedRegistrations = Object.freeze([
  'world-locations',
  'party',
  'session-generation',
  'session-planner'
] as const)

const commandIdsSchema = z
  .object({
    createManualTreasure: z.uuid(),
    acceptGeneratedTreasure: z.uuid(),
    distributeManualTreasure: z.uuid()
  })
  .strict()

const campaignSchema = z
  .object({
    role: z.enum(['A', 'B']),
    materialization: z
      .object({
        targetLocationExternalKey: z.string().min(1),
        symbolLocationSemanticKey: z.string().regex(/^location:[a-z0-9-]+$/),
        symbolLocationName: z.string().trim().min(1).max(100),
        symbolLocationTags: z.array(z.string().trim().min(1).max(40)).min(1),
        legacyDefinition: itemDefinitionSchema,
        manualTreasureLabel: z.string().trim().min(1),
        generatedTreasureLabel: z.string().trim().min(1),
        manualContainerId: z.uuid(),
        manualContainerName: z.string().trim().min(1),
        manualContainerCapacity: z.number().positive(),
        manualItemQuantity: z.literal(2),
        distributionQuantity: z.literal(1),
        commandIds: commandIdsSchema
      })
      .strict(),
    expected: z
      .object({
        locationRevision: z.number().int().positive(),
        mapPresentationRevision: z.literal(1),
        lootProjectionRevision: z.literal(3),
        manualTreasureRevision: z.literal(1),
        manualDistributionState: z.literal('partial'),
        ledgerRevision: z.literal(1),
        ledgerEntryCount: z.literal(1),
        inboxEntryCount: z.literal(1),
        sceneLocationTreasureCount: z.literal(1),
        manualTotalValueCp: z.number().int().positive(),
        manualAllocatedValueCp: z.number().int().positive(),
        semanticSha256: z.string().regex(/^[0-9a-f]{64}$/)
      })
      .strict()
  })
  .strict()

export const currentFormatEconomyFixtureSchema = z
  .object({
    version: z.literal(1),
    identity: z.literal('frontend-robustness-current-format-economy-v1'),
    preparationFixtureIdentity: z.literal(
      'frontend-robustness-current-format-preparation-v1'
    ),
    qualificationClaim: z.literal(
      'partial-fr2f2c2a-economy-installation-cohort-not-complete-current-format'
    ),
    coveredCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatEconomyRegistrations.length),
    coveredInstallationAuthorities: z
      .array(z.string())
      .length(currentFormatEconomyInstallationAuthorities.length),
    extendedCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatEconomyExtendedRegistrations.length),
    installation: z
      .object({
        locationSymbolName: z.string().trim().min(1).max(100),
        locationSymbolSource: z.string().min(1),
        expectedLocationSymbolRevision: z.literal(1),
        sessionLayout: sessionLayoutPreferenceSchema,
        expectedSettingsRevision: z.literal(1),
        expectedSystemBiomeIds: z.array(z.string().min(1)).min(1)
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
        message: 'Economy fixture Campaign roles must be exactly A then B.'
      })
    unique(
      fixture.campaigns.flatMap(({ materialization }) => [
        materialization.symbolLocationSemanticKey,
        materialization.symbolLocationName,
        materialization.legacyDefinition.reference.kind === 'legacy'
          ? materialization.legacyDefinition.reference.definitionId
          : '',
        materialization.manualTreasureLabel,
        materialization.generatedTreasureLabel,
        materialization.manualContainerId,
        ...Object.values(materialization.commandIds)
      ]),
      ['campaigns'],
      context
    )
    for (const [index, campaign] of fixture.campaigns.entries())
      if (campaign.materialization.legacyDefinition.reference.kind !== 'legacy')
        context.addIssue({
          code: 'custom',
          path: [
            'campaigns',
            index,
            'materialization',
            'legacyDefinition',
            'reference'
          ],
          message: 'Economy fixture definitions must use legacy identities.'
        })
  })

export type CurrentFormatEconomyFixture = Readonly<
  z.infer<typeof currentFormatEconomyFixtureSchema>
>
export type CurrentFormatEconomyCampaign = Readonly<
  CurrentFormatEconomyFixture['campaigns'][number]
>

export function loadCurrentFormatEconomyFixture(
  path: string,
  manifest: CurrentFormatCampaignManifest,
  preparationFixture: CurrentFormatPreparationFixture,
  spatialFixture: CurrentFormatSpatialFixture
): CurrentFormatEconomyFixture {
  return validateCurrentFormatEconomyFixture(
    JSON.parse(readFileSync(path, 'utf8')),
    manifest,
    preparationFixture,
    spatialFixture
  )
}

export function validateCurrentFormatEconomyFixture(
  raw: unknown,
  manifest: CurrentFormatCampaignManifest,
  preparationFixture: CurrentFormatPreparationFixture,
  spatialFixture: CurrentFormatSpatialFixture
): CurrentFormatEconomyFixture {
  const fixture = currentFormatEconomyFixtureSchema.parse(raw)
  if (fixture.preparationFixtureIdentity !== preparationFixture.identity)
    throw new Error('Current-format economy preparation identity is stale.')
  assertExact(
    fixture.coveredCampaignRegistrations,
    currentFormatEconomyRegistrations,
    'Campaign coverage'
  )
  assertExact(
    fixture.coveredInstallationAuthorities,
    currentFormatEconomyInstallationAuthorities,
    'installation coverage'
  )
  assertExact(
    fixture.extendedCampaignRegistrations,
    currentFormatEconomyExtendedRegistrations,
    'extended Campaign coverage'
  )

  const owners = new Map(
    manifest.campaignOwners.map((owner) => [owner.registration, owner])
  )
  for (const registration of currentFormatEconomyRegistrations) {
    const owner = owners.get(registration)
    if (!owner || owner.disposition !== 'fixture-load')
      throw new Error(
        `Current-format economy owner ${registration} is not fixture-load.`
      )
  }
  const dependencies = new Map(
    manifest.installationDependencies.map((dependency) => [
      dependency.authority,
      dependency
    ])
  )
  for (const authority of currentFormatEconomyInstallationAuthorities) {
    const dependency = dependencies.get(authority)
    if (!dependency || !dependency.disposition.startsWith('shared-'))
      throw new Error(
        `Current-format economy installation dependency ${authority} is not shared.`
      )
  }

  for (const campaign of fixture.campaigns) {
    const preparation = preparationFixture.campaigns.find(
      ({ role }) => role === campaign.role
    )
    if (
      campaign.materialization.targetLocationExternalKey !==
      preparation?.materialization.referencedLocationExternalKey
    )
      throw new Error(
        `Current-format economy Campaign ${campaign.role} target Location is stale.`
      )
    const definition = campaign.materialization.legacyDefinition
    const expectedTotal =
      definition.unitValueCp * campaign.materialization.manualItemQuantity
    const expectedAllocated =
      definition.unitValueCp * campaign.materialization.distributionQuantity
    if (
      campaign.expected.manualTotalValueCp !== expectedTotal ||
      campaign.expected.manualAllocatedValueCp !== expectedAllocated
    )
      throw new Error(
        `Current-format economy Campaign ${campaign.role} value sentinel is stale.`
      )
  }

  const biomeIds = [
    ...new Set(
      spatialFixture.campaigns.flatMap(({ materialization }) => [
        materialization.routeBiomeId,
        materialization.sparseSentinel.biomeId
      ])
    )
  ].sort()
  assertExact(
    fixture.installation.expectedSystemBiomeIds,
    biomeIds,
    'system Biome coverage'
  )
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
    throw new Error(`Current-format economy ${label} does not match.`)
}

function unique(
  values: readonly string[],
  path: readonly (string | number)[],
  context: z.RefinementCtx
): void {
  if (!values.includes('') && new Set(values).size === values.length) return
  context.addIssue({
    code: 'custom',
    path: [...path],
    message: 'Economy fixture identities must be present and unique.'
  })
}
