import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { creatureById } from '../../src/core/creatures/catalog.js'
import { partyCharacterDraftSchema } from '../../src/shared/contracts/party.js'
import {
  sceneGroupDispositionSchema,
  sceneGroupDraftEntrySchema
} from '../../src/shared/contracts/scene.js'
import type { CurrentFormatCampaignManifest } from './current-format-campaign-manifest.js'
import type {
  CurrentFormatRootCampaign,
  CurrentFormatRootFixture
} from './current-format-root-fixture.js'

export const currentFormatLiveRegistrations = Object.freeze([
  'scene',
  'combat'
] as const)

export const currentFormatLiveExtendedRootRegistrations = Object.freeze([
  'world-locations',
  'party'
] as const)

const liveGroupSchema = z
  .object({
    semanticKey: z.string().regex(/^group:[a-z0-9-]+$/),
    name: z.string().trim().min(1).max(100),
    note: z.string().trim().max(1_000),
    disposition: sceneGroupDispositionSchema,
    archived: z.boolean(),
    entries: z.array(sceneGroupDraftEntrySchema)
  })
  .strict()

const liveCampaignMaterializationSchema = z
  .object({
    importedActivePartyExternalKeys: z.array(z.string().min(1)).min(1),
    addedInactiveParty: z
      .object({
        semanticKey: z.string().regex(/^pc:[a-z0-9-]+$/),
        draft: partyCharacterDraftSchema
      })
      .strict(),
    focusedLocationExternalKey: z.string().min(1),
    groups: z.array(liveGroupSchema).min(2),
    combatGroupSemanticKey: z.string().regex(/^group:[a-z0-9-]+$/)
  })
  .strict()
  .superRefine((materialization, context) => {
    unique(
      materialization.importedActivePartyExternalKeys,
      ['importedActivePartyExternalKeys'],
      context
    )
    unique(
      materialization.groups.map(({ semanticKey }) => semanticKey),
      ['groups'],
      context
    )
    unique(
      materialization.groups.map(({ name }) => name),
      ['groups'],
      context
    )
    const combatGroup = materialization.groups.find(
      ({ semanticKey }) =>
        semanticKey === materialization.combatGroupSemanticKey
    )
    if (!combatGroup)
      context.addIssue({
        code: 'custom',
        path: ['combatGroupSemanticKey'],
        message: 'Live fixture Combat Group must exist.'
      })
    else if (combatGroup.archived || combatGroup.entries.length === 0)
      context.addIssue({
        code: 'custom',
        path: ['combatGroupSemanticKey'],
        message: 'Live fixture Combat Group must be active and non-empty.'
      })
    if (!materialization.groups.some(({ archived }) => archived))
      context.addIssue({
        code: 'custom',
        path: ['groups'],
        message: 'Live fixture needs an archived Group sentinel.'
      })
  })

const liveExpectedSchema = z
  .object({
    partyRevision: z.number().int().nonnegative(),
    sceneRevision: z.number().int().nonnegative(),
    combatRevision: z.number().int().nonnegative(),
    combatPhase: z.literal('initiative'),
    activePartyCount: z.number().int().positive(),
    inactivePartyCount: z.number().int().positive(),
    groupCount: z.number().int().min(2),
    archivedGroupCount: z.number().int().positive(),
    focusedLocationName: z.string().min(1),
    semanticSha256: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict()

const liveCampaignSchema = z
  .object({
    role: z.enum(['A', 'B']),
    materialization: liveCampaignMaterializationSchema,
    expected: liveExpectedSchema
  })
  .strict()

export const currentFormatLiveFixtureSchema = z
  .object({
    version: z.literal(1),
    identity: z.literal('frontend-robustness-current-format-live-v1'),
    rootFixtureIdentity: z.literal(
      'frontend-robustness-current-format-root-v1'
    ),
    qualificationClaim: z.literal(
      'partial-fr2f2b1-live-cohort-not-complete-current-format'
    ),
    coveredCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatLiveRegistrations.length),
    extendedRootRegistrations: z
      .array(z.string())
      .length(currentFormatLiveExtendedRootRegistrations.length),
    campaigns: z.array(liveCampaignSchema).length(2)
  })
  .strict()
  .superRefine((fixture, context) => {
    if (fixture.campaigns.map(({ role }) => role).join(',') !== 'A,B')
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Live fixture Campaign roles must be exactly A then B.'
      })
    unique(
      fixture.campaigns.map(
        ({ materialization }) => materialization.addedInactiveParty.semanticKey
      ),
      ['campaigns'],
      context
    )
    unique(
      fixture.campaigns.flatMap(({ materialization }) =>
        materialization.groups.map(({ semanticKey }) => semanticKey)
      ),
      ['campaigns'],
      context
    )
  })

export type CurrentFormatLiveFixture = Readonly<
  z.infer<typeof currentFormatLiveFixtureSchema>
>
export type CurrentFormatLiveCampaign = Readonly<
  CurrentFormatLiveFixture['campaigns'][number]
>

export function loadCurrentFormatLiveFixture(
  path: string,
  manifest: CurrentFormatCampaignManifest,
  rootFixture: CurrentFormatRootFixture
): CurrentFormatLiveFixture {
  return validateCurrentFormatLiveFixture(
    JSON.parse(readFileSync(path, 'utf8')),
    manifest,
    rootFixture
  )
}

export function validateCurrentFormatLiveFixture(
  raw: unknown,
  manifest: CurrentFormatCampaignManifest,
  rootFixture: CurrentFormatRootFixture
): CurrentFormatLiveFixture {
  const fixture = currentFormatLiveFixtureSchema.parse(raw)
  assertExactOrder(
    fixture.coveredCampaignRegistrations,
    currentFormatLiveRegistrations,
    'coverage'
  )
  assertExactOrder(
    fixture.extendedRootRegistrations,
    currentFormatLiveExtendedRootRegistrations,
    'extended root coverage'
  )
  if (fixture.rootFixtureIdentity !== rootFixture.identity)
    throw new Error('Current-format live fixture root identity is stale.')

  const manifestOwners = new Map(
    manifest.campaignOwners.map((owner) => [owner.registration, owner])
  )
  for (const registration of currentFormatLiveRegistrations) {
    const owner = manifestOwners.get(registration)
    if (!owner)
      throw new Error(
        `Current-format live fixture references unknown owner ${registration}.`
      )
    if (owner.disposition !== 'switch-oracle')
      throw new Error(
        `Current-format live owner ${registration} is not a switch oracle.`
      )
  }
  for (const registration of currentFormatLiveExtendedRootRegistrations) {
    if (!rootFixture.coveredCampaignRegistrations.includes(registration))
      throw new Error(
        `Current-format live extension ${registration} is not rooted in FR2F2A.`
      )
  }
  const covered = new Set<string>(currentFormatLiveRegistrations)
  const manifestOrder = manifest.campaignOwners
    .map(({ registration }) => registration)
    .filter((registration) => covered.has(registration))
  assertExactOrder(manifestOrder, currentFormatLiveRegistrations, 'order')

  for (const configured of fixture.campaigns) {
    const rootCampaign = rootFixture.campaigns.find(
      ({ role }) => role === configured.role
    )
    if (!rootCampaign)
      throw new Error(
        `Current-format live Campaign ${configured.role} has no root Campaign.`
      )
    validateCampaign(configured, rootCampaign)
  }
  return fixture
}

function validateCampaign(
  configured: CurrentFormatLiveCampaign,
  rootCampaign: CurrentFormatRootCampaign
): void {
  const materialization = configured.materialization
  const partyKeys = new Set(
    rootCampaign.bundle.party.map(({ externalKey }) => externalKey)
  )
  for (const externalKey of materialization.importedActivePartyExternalKeys)
    if (!partyKeys.has(externalKey))
      throw new Error(
        `Current-format live Campaign ${configured.role} references unknown Party ${externalKey}.`
      )
  if (
    rootCampaign.bundle.party.some(
      ({ name }) => name === materialization.addedInactiveParty.draft.name
    )
  )
    throw new Error(
      `Current-format live Campaign ${configured.role} has a duplicate Party name.`
    )
  if (
    !rootCampaign.bundle.locations.some(
      ({ externalKey }) =>
        externalKey === materialization.focusedLocationExternalKey
    )
  )
    throw new Error(
      `Current-format live Campaign ${configured.role} references an unknown Location.`
    )
  for (const group of materialization.groups)
    for (const entry of group.entries)
      if (!creatureById(entry.creatureId))
        throw new Error(
          `Current-format live Campaign ${configured.role} references unknown creature ${entry.creatureId}.`
        )
}

function assertExactOrder(
  actual: readonly string[],
  expected: readonly string[],
  label: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  )
    throw new Error(
      `Current-format live fixture ${label} does not match the FR2F2B1 contract.`
    )
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
    message: 'Live fixture semantic identities must be unique.'
  })
}
