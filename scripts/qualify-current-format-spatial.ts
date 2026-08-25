import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDefaultCampaignSchemaBootstrapper } from '../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../src/core/persistence/sqlite/database.js'
import { validateCurrentFormatCampaignManifest } from './qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatLiveFixture } from './qualification/current-format-live-fixture.js'
import { loadCurrentFormatRootFixture } from './qualification/current-format-root-fixture.js'
import { loadCurrentFormatSpatialFixture } from './qualification/current-format-spatial-fixture.js'
import { materializeCurrentFormatSpatialFixture } from './qualification/current-format-spatial-materializer.js'
import {
  assertCurrentFormatSpatialReadback,
  assertCurrentFormatSpatialReceipt,
  readCurrentFormatSpatialFixture
} from './qualification/current-format-spatial-readback.js'

const dataRoot = resolve(requiredArgument('--data-root'))
const manifest = validateCurrentFormatCampaignManifest(
  JSON.parse(
    readFileSync(
      'docs/project/evidence/frontend-robustness-current-format-manifest.v1.json',
      'utf8'
    )
  ),
  {
    campaignDatabaseSchemaVersion: databaseSchemaVersions.campaign,
    campaignSchemaRegistrations:
      createDefaultCampaignSchemaBootstrapper().names()
  }
)
const rootFixture = loadCurrentFormatRootFixture(
  'docs/project/evidence/frontend-robustness-current-format-root-fixture.v1.json',
  manifest
)
const liveFixture = loadCurrentFormatLiveFixture(
  'docs/project/evidence/frontend-robustness-current-format-live-fixture.v1.json',
  manifest,
  rootFixture
)
const spatialFixture = loadCurrentFormatSpatialFixture(
  'docs/project/evidence/frontend-robustness-current-format-spatial-fixture.v1.json',
  manifest,
  rootFixture,
  liveFixture
)
const materialization = materializeCurrentFormatSpatialFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture
)
const readback = readCurrentFormatSpatialFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture
)
assertCurrentFormatSpatialReadback(rootFixture, spatialFixture, readback)
assertCurrentFormatSpatialReceipt(materialization, readback)

process.stdout.write(
  `${JSON.stringify({
    kind: 'current-format-spatial-qualification',
    fixtureIdentity: spatialFixture.identity,
    qualificationClaim: spatialFixture.qualificationClaim,
    coveredCampaignRegistrations: spatialFixture.coveredCampaignRegistrations,
    extendedCampaignRegistrations: spatialFixture.extendedCampaignRegistrations,
    activeCampaignRole: materialization.activeCampaignRole,
    campaigns: readback.campaigns.map((campaign) => ({
      role: campaign.role,
      campaignId: campaign.campaignId,
      mapId: campaign.mapId,
      mapContentRevision: campaign.catalog.maps[0]?.contentRevision ?? null,
      partyRevision: campaign.session.party.revision,
      sceneRevision: campaign.session.scene.revision,
      travelRevision: campaign.travel.revision,
      travelStatus: campaign.travel.status,
      current: campaign.travel.current,
      gameTimeSeconds: campaign.travel.gameTimeSeconds,
      semanticSha256: campaign.semanticSha256
    })),
    semanticReadback: true
  })}\n`
)

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = process.argv[index + 1]
  if (index < 0 || !value) throw new Error(`${name} is required`)
  return value
}
