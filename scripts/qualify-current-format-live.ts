import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDefaultCampaignSchemaBootstrapper } from '../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../src/core/persistence/sqlite/database.js'
import { validateCurrentFormatCampaignManifest } from './qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatRootFixture } from './qualification/current-format-root-fixture.js'
import { loadCurrentFormatLiveFixture } from './qualification/current-format-live-fixture.js'
import { materializeCurrentFormatLiveFixture } from './qualification/current-format-live-materializer.js'
import {
  assertCurrentFormatLiveReceipt,
  assertCurrentFormatLiveReadback,
  readCurrentFormatLiveFixture
} from './qualification/current-format-live-readback.js'

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
const materialization = materializeCurrentFormatLiveFixture(
  dataRoot,
  rootFixture,
  liveFixture
)
const readback = readCurrentFormatLiveFixture(
  dataRoot,
  rootFixture,
  liveFixture
)
assertCurrentFormatLiveReadback(rootFixture, liveFixture, readback)
assertCurrentFormatLiveReceipt(materialization, readback)

process.stdout.write(
  `${JSON.stringify({
    kind: 'current-format-live-qualification',
    fixtureIdentity: liveFixture.identity,
    qualificationClaim: liveFixture.qualificationClaim,
    coveredCampaignRegistrations: liveFixture.coveredCampaignRegistrations,
    extendedRootRegistrations: liveFixture.extendedRootRegistrations,
    activeCampaignRole: materialization.activeCampaignRole,
    campaigns: readback.campaigns.map((campaign) => ({
      role: campaign.role,
      campaignId: campaign.campaignId,
      partyRevision: campaign.session.party.revision,
      sceneRevision: campaign.session.scene.revision,
      combatRevision: campaign.session.combat?.revision ?? null,
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
