import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
  campaignImportBundleSchema,
  type CampaignImportBundle
} from '../../src/shared/contracts/campaign-import.js'
import { campaignImportExportHash } from '../../src/core/campaign-import/campaign-import-service.js'
import type { CurrentFormatCampaignManifest } from './current-format-campaign-manifest.js'

export const currentFormatRootRegistrations = Object.freeze([
  'campaign-runtime',
  'world-factions',
  'world-locations',
  'party',
  'world-npcs',
  'campaign-import',
  'schema-metadata',
  'schema-version'
] as const)

export const currentFormatRootInstallationAuthorities = Object.freeze([
  'installation.campaign-registry'
] as const)

const campaignRoleSchema = z.enum(['A', 'B'])

const rootCampaignSchema = z
  .object({
    role: campaignRoleSchema,
    bundle: campaignImportBundleSchema
  })
  .strict()

export const currentFormatRootFixtureSchema = z
  .object({
    version: z.literal(1),
    identity: z.literal('frontend-robustness-current-format-root-v1'),
    qualificationClaim: z.literal(
      'partial-fr2f2a-root-cohort-not-complete-current-format'
    ),
    coveredCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatRootRegistrations.length),
    coveredInstallationAuthorities: z
      .array(z.string())
      .length(currentFormatRootInstallationAuthorities.length),
    campaigns: z.array(rootCampaignSchema).length(2)
  })
  .strict()
  .superRefine((fixture, context) => {
    const roles = fixture.campaigns.map(({ role }) => role)
    if (roles.join(',') !== 'A,B')
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Root fixture Campaign roles must be exactly A then B.'
      })
    const sourceIds = fixture.campaigns.map(({ bundle }) => bundle.source.id)
    if (new Set(sourceIds).size !== sourceIds.length)
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Root fixture source identities must be unique.'
      })
    if (
      fixture.campaigns[0]?.bundle.campaign.name ===
      fixture.campaigns[1]?.bundle.campaign.name
    )
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Root fixture Campaign names must be distinct.'
      })
  })

export type CurrentFormatRootFixture = Readonly<
  z.infer<typeof currentFormatRootFixtureSchema>
>
export type CurrentFormatRootCampaign = Readonly<
  CurrentFormatRootFixture['campaigns'][number]
>
export type CurrentFormatCampaignRole = z.infer<typeof campaignRoleSchema>

export function loadCurrentFormatRootFixture(
  path: string,
  manifest: CurrentFormatCampaignManifest
): CurrentFormatRootFixture {
  return validateCurrentFormatRootFixture(
    JSON.parse(readFileSync(path, 'utf8')),
    manifest
  )
}

export function validateCurrentFormatRootFixture(
  raw: unknown,
  manifest: CurrentFormatCampaignManifest
): CurrentFormatRootFixture {
  const fixture = currentFormatRootFixtureSchema.parse(raw)
  if (
    fixture.coveredCampaignRegistrations.some(
      (registration, index) =>
        registration !== currentFormatRootRegistrations[index]
    )
  )
    throw new Error(
      'Current-format root fixture coverage does not match the FR2F2A contract.'
    )
  if (
    fixture.coveredInstallationAuthorities.some(
      (authority, index) =>
        authority !== currentFormatRootInstallationAuthorities[index]
    )
  )
    throw new Error(
      'Current-format root installation coverage does not match the FR2F2A contract.'
    )
  const manifestOwners = new Map(
    manifest.campaignOwners.map((owner) => [owner.registration, owner])
  )
  for (const registration of currentFormatRootRegistrations)
    if (!manifestOwners.has(registration))
      throw new Error(
        `Current-format root fixture references unknown owner ${registration}.`
      )
  for (const authority of currentFormatRootInstallationAuthorities)
    if (
      !manifest.installationDependencies.some(
        (dependency) => dependency.authority === authority
      )
    )
      throw new Error(
        `Current-format root fixture references unknown installation dependency ${authority}.`
      )
  const coveredRegistrationSet = new Set<string>(currentFormatRootRegistrations)
  const coveredInManifestOrder = manifest.campaignOwners
    .map(({ registration }) => registration)
    .filter((registration) => coveredRegistrationSet.has(registration))
  if (
    coveredInManifestOrder.some(
      (registration, index) =>
        registration !== currentFormatRootRegistrations[index]
    )
  )
    throw new Error(
      'Current-format root fixture coverage is not in Campaign bootstrap order.'
    )
  for (const campaign of fixture.campaigns) {
    const actualHash = campaignImportExportHash(
      campaign.bundle as CampaignImportBundle
    )
    if (campaign.bundle.source.exportHash !== actualHash)
      throw new Error(
        `Current-format root fixture ${campaign.role} export hash is invalid.`
      )
  }
  return fixture
}
