import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { biomeDefinition } from '../../src/core/hex/biome-catalog.js'
import { chunkKeyFor } from '../../src/core/hex/hex-map-store.js'
import {
  axialDistance,
  travelGameSeconds
} from '../../src/core/hex/hex-travel.js'
import {
  axialCoordinateSchema,
  hexBiomeIdSchema
} from '../../src/shared/contracts/hex.js'
import type { CurrentFormatCampaignManifest } from './current-format-campaign-manifest.js'
import type {
  CurrentFormatLiveCampaign,
  CurrentFormatLiveFixture
} from './current-format-live-fixture.js'
import type {
  CurrentFormatRootCampaign,
  CurrentFormatRootFixture
} from './current-format-root-fixture.js'

export const currentFormatSpatialRegistrations = Object.freeze(['hex'] as const)

export const currentFormatSpatialExtendedRegistrations = Object.freeze([
  'world-locations',
  'party',
  'scene'
] as const)

const spatialCommandIdsSchema = z
  .object({
    createMap: z.uuid(),
    paintRoute: z.uuid(),
    paintSparseSentinel: z.uuid(),
    placeLocation: z.uuid()
  })
  .strict()

const spatialMaterializationSchema = z
  .object({
    mapSemanticKey: z.string().regex(/^hex-map:[a-z0-9-]+$/),
    mapName: z.string().trim().min(1).max(100),
    commandIds: spatialCommandIdsSchema,
    routeBiomeId: hexBiomeIdSchema,
    routeCoordinates: z.array(axialCoordinateSchema).length(3),
    sparseSentinel: z
      .object({
        coordinate: axialCoordinateSchema,
        biomeId: hexBiomeIdSchema
      })
      .strict(),
    placedLocationExternalKey: z.string().min(1),
    placedLocationCoordinate: axialCoordinateSchema,
    travel: z
      .object({
        startCoordinate: axialCoordinateSchema,
        waypoints: z.array(axialCoordinateSchema).length(1),
        multiplier: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(5),
          z.literal(10)
        ]),
        startedAt: z.number().int().nonnegative(),
        advanceTo: z.number().int().nonnegative(),
        finalStatus: z.enum(['paused', 'travelling'])
      })
      .strict()
  })
  .strict()

const spatialExpectedSchema = z
  .object({
    catalogRevision: z.literal(1),
    mapMetadataRevision: z.literal(0),
    mapContentRevision: z.literal(3),
    authoredTileCount: z.literal(4),
    chunkCount: z.literal(2),
    historyUndoLabel: z.literal('location_place'),
    partyRevision: z.number().int().nonnegative(),
    sceneRevision: z.number().int().nonnegative(),
    combatRevision: z.number().int().nonnegative(),
    travelRevision: z.number().int().nonnegative(),
    travelStatus: z.enum(['paused', 'travelling']),
    currentIndex: z.literal(1),
    segmentGameSeconds: z.number().int().positive(),
    gameTimeSeconds: z.number().int().positive(),
    currentCoordinate: axialCoordinateSchema,
    routeLength: z.literal(3),
    locationName: z.string().min(1),
    segmentStartedAt: z.number().int().nonnegative().nullable(),
    segmentEndsAt: z.number().int().nonnegative().nullable(),
    nextBoundaryDelay: z.number().int().nonnegative().nullable(),
    semanticSha256: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict()

const spatialCampaignSchema = z
  .object({
    role: z.enum(['A', 'B']),
    materialization: spatialMaterializationSchema,
    expected: spatialExpectedSchema
  })
  .strict()

export const currentFormatSpatialFixtureSchema = z
  .object({
    version: z.literal(1),
    identity: z.literal('frontend-robustness-current-format-spatial-v1'),
    rootFixtureIdentity: z.literal(
      'frontend-robustness-current-format-root-v1'
    ),
    liveFixtureIdentity: z.literal(
      'frontend-robustness-current-format-live-v1'
    ),
    qualificationClaim: z.literal(
      'partial-fr2f2b2-spatial-cohort-not-complete-current-format'
    ),
    coveredCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatSpatialRegistrations.length),
    extendedCampaignRegistrations: z
      .array(z.string())
      .length(currentFormatSpatialExtendedRegistrations.length),
    campaigns: z.array(spatialCampaignSchema).length(2)
  })
  .strict()
  .superRefine((fixture, context) => {
    if (fixture.campaigns.map(({ role }) => role).join(',') !== 'A,B')
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Spatial fixture Campaign roles must be exactly A then B.'
      })
    unique(
      fixture.campaigns.map(
        ({ materialization }) => materialization.mapSemanticKey
      ),
      ['campaigns'],
      context
    )
    unique(
      fixture.campaigns.map(({ materialization }) => materialization.mapName),
      ['campaigns'],
      context
    )
    unique(
      fixture.campaigns.flatMap(({ materialization }) =>
        Object.values(materialization.commandIds)
      ),
      ['campaigns'],
      context
    )
    if (
      fixture.campaigns
        .map(({ materialization }) => materialization.travel.finalStatus)
        .join(',') !== 'paused,travelling'
    )
      context.addIssue({
        code: 'custom',
        path: ['campaigns'],
        message: 'Spatial fixture must cover paused A and travelling B.'
      })
  })

export type CurrentFormatSpatialFixture = Readonly<
  z.infer<typeof currentFormatSpatialFixtureSchema>
>
export type CurrentFormatSpatialCampaign = Readonly<
  CurrentFormatSpatialFixture['campaigns'][number]
>

export function loadCurrentFormatSpatialFixture(
  path: string,
  manifest: CurrentFormatCampaignManifest,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture
): CurrentFormatSpatialFixture {
  return validateCurrentFormatSpatialFixture(
    JSON.parse(readFileSync(path, 'utf8')),
    manifest,
    rootFixture,
    liveFixture
  )
}

export function validateCurrentFormatSpatialFixture(
  raw: unknown,
  manifest: CurrentFormatCampaignManifest,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture
): CurrentFormatSpatialFixture {
  const fixture = currentFormatSpatialFixtureSchema.parse(raw)
  assertExactOrder(
    fixture.coveredCampaignRegistrations,
    currentFormatSpatialRegistrations,
    'coverage'
  )
  assertExactOrder(
    fixture.extendedCampaignRegistrations,
    currentFormatSpatialExtendedRegistrations,
    'extended coverage'
  )
  if (fixture.rootFixtureIdentity !== rootFixture.identity)
    throw new Error('Current-format spatial fixture root identity is stale.')
  if (fixture.liveFixtureIdentity !== liveFixture.identity)
    throw new Error('Current-format spatial fixture Live identity is stale.')

  const owner = manifest.campaignOwners.find(
    ({ registration }) => registration === 'hex'
  )
  if (!owner || owner.disposition !== 'switch-oracle')
    throw new Error('Current-format spatial owner hex is not a switch oracle.')
  const manifestOrder = manifest.campaignOwners
    .map(({ registration }) => registration)
    .filter((registration) => registration === 'hex')
  assertExactOrder(manifestOrder, currentFormatSpatialRegistrations, 'order')
  for (const registration of ['world-locations', 'party'] as const)
    if (!rootFixture.coveredCampaignRegistrations.includes(registration))
      throw new Error(
        `Current-format spatial extension ${registration} is not rooted in FR2F2A.`
      )
  if (!liveFixture.coveredCampaignRegistrations.includes('scene'))
    throw new Error(
      'Current-format spatial extension scene is not rooted in FR2F2B1.'
    )

  for (const configured of fixture.campaigns) {
    const root = rootFixture.campaigns.find(
      ({ role }) => role === configured.role
    )
    const live = liveFixture.campaigns.find(
      ({ role }) => role === configured.role
    )
    if (!root || !live)
      throw new Error(
        `Current-format spatial Campaign ${configured.role} has no root/Live Campaign.`
      )
    validateCampaign(configured, root, live)
  }
  return fixture
}

function validateCampaign(
  configured: CurrentFormatSpatialCampaign,
  root: CurrentFormatRootCampaign,
  live: CurrentFormatLiveCampaign
): void {
  const materialization = configured.materialization
  const route = materialization.routeCoordinates
  if (
    route
      .slice(1)
      .some(
        (coordinate, index) => axialDistance(route[index]!, coordinate) !== 1
      )
  )
    throw new Error(
      `Current-format spatial Campaign ${configured.role} route is not adjacent.`
    )
  if (!sameCoordinate(materialization.travel.startCoordinate, route[0]!))
    throw new Error(
      `Current-format spatial Campaign ${configured.role} start is not the route origin.`
    )
  if (
    !sameCoordinate(
      materialization.travel.waypoints[0]!,
      route[route.length - 1]!
    )
  )
    throw new Error(
      `Current-format spatial Campaign ${configured.role} waypoint is not the route destination.`
    )
  if (!sameCoordinate(materialization.placedLocationCoordinate, route[1]!))
    throw new Error(
      `Current-format spatial Campaign ${configured.role} placement is not the first checkpoint.`
    )
  if (
    materialization.placedLocationExternalKey !==
    live.materialization.focusedLocationExternalKey
  )
    throw new Error(
      `Current-format spatial Campaign ${configured.role} placement does not restore the focused Location.`
    )
  const location = root.bundle.locations.find(
    ({ externalKey }) =>
      externalKey === materialization.placedLocationExternalKey
  )
  if (!location)
    throw new Error(
      `Current-format spatial Campaign ${configured.role} references an unknown Location.`
    )
  if (
    chunkId(chunkKeyFor(materialization.sparseSentinel.coordinate)) ===
    chunkId(chunkKeyFor(route[0]!))
  )
    throw new Error(
      `Current-format spatial Campaign ${configured.role} sparse sentinel is not in a distinct chunk.`
    )

  const routeBiome = biomeDefinition(materialization.routeBiomeId)
  const sparseBiome = biomeDefinition(materialization.sparseSentinel.biomeId)
  if (!routeBiome.passable || !sparseBiome.passable)
    throw new Error(
      `Current-format spatial Campaign ${configured.role} uses an impassable biome.`
    )
  const activeMembers =
    live.materialization.importedActivePartyExternalKeys.map((externalKey) =>
      root.bundle.party.find((member) => member.externalKey === externalKey)
    )
  if (activeMembers.some((member) => !member))
    throw new Error(
      `Current-format spatial Campaign ${configured.role} has an unknown travelling Party member.`
    )
  const speed = Math.min(
    ...activeMembers.map((member) => member!.movementSpeedFeet ?? 30)
  )
  const gameSeconds = travelGameSeconds(speed, routeBiome.travelCost)
  const boundaryMilliseconds =
    (gameSeconds * 1_000) / 3_600 / materialization.travel.multiplier
  if (!Number.isInteger(boundaryMilliseconds))
    throw new Error(
      `Current-format spatial Campaign ${configured.role} has a fractional controlled boundary.`
    )
  if (
    materialization.travel.advanceTo !==
    materialization.travel.startedAt + boundaryMilliseconds
  )
    throw new Error(
      `Current-format spatial Campaign ${configured.role} clock does not stop at the first boundary.`
    )

  const expected = configured.expected
  if (
    expected.travelStatus !== materialization.travel.finalStatus ||
    expected.currentCoordinate.q !== route[1]!.q ||
    expected.currentCoordinate.r !== route[1]!.r ||
    expected.segmentGameSeconds !== gameSeconds ||
    expected.gameTimeSeconds !== 28_800 + gameSeconds ||
    expected.locationName !== location.displayName
  )
    throw new Error(
      `Current-format spatial Campaign ${configured.role} readable oracle is inconsistent.`
    )
  const paused = materialization.travel.finalStatus === 'paused'
  if (
    expected.travelRevision !== (paused ? 2 : 1) ||
    expected.segmentStartedAt !==
      (paused ? null : materialization.travel.advanceTo) ||
    expected.segmentEndsAt !==
      (paused
        ? null
        : materialization.travel.advanceTo + boundaryMilliseconds) ||
    expected.nextBoundaryDelay !== (paused ? null : boundaryMilliseconds)
  )
    throw new Error(
      `Current-format spatial Campaign ${configured.role} journey oracle is inconsistent.`
    )
}

export function spatialChunkKeys(
  configured: CurrentFormatSpatialCampaign
): readonly Readonly<{ q: number; r: number }>[] {
  const keys = new Map<string, Readonly<{ q: number; r: number }>>()
  for (const coordinate of [
    ...configured.materialization.routeCoordinates,
    configured.materialization.sparseSentinel.coordinate
  ]) {
    const key = chunkKeyFor(coordinate)
    keys.set(chunkId(key), key)
  }
  return [...keys.values()].sort(
    (left, right) => left.q - right.q || left.r - right.r
  )
}

function sameCoordinate(
  left: Readonly<{ q: number; r: number }>,
  right: Readonly<{ q: number; r: number }>
): boolean {
  return left.q === right.q && left.r === right.r
}

function chunkId(key: Readonly<{ q: number; r: number }>): string {
  return `${key.q}:${key.r}`
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
      `Current-format spatial fixture ${label} does not match the FR2F2B2 contract.`
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
    message: 'Spatial fixture semantic identities must be unique.'
  })
}
