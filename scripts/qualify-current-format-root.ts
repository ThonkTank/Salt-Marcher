import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDefaultCampaignSchemaBootstrapper } from '../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../src/core/persistence/sqlite/database.js'
import { validateCurrentFormatCampaignManifest } from './qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatRootFixture } from './qualification/current-format-root-fixture.js'
import { materializeCurrentFormatRootFixture } from './qualification/current-format-root-materializer.js'
import {
  assertCurrentFormatRootReadback,
  readCurrentFormatRootFixture
} from './qualification/current-format-root-readback.js'

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
const fixture = loadCurrentFormatRootFixture(
  'docs/project/evidence/frontend-robustness-current-format-root-fixture.v1.json',
  manifest
)
const materialization = materializeCurrentFormatRootFixture(dataRoot, fixture)
const readback = readCurrentFormatRootFixture(dataRoot, fixture)
assertCurrentFormatRootReadback(fixture, readback)

process.stdout.write(
  `${JSON.stringify({
    kind: 'current-format-root-qualification',
    fixtureIdentity: fixture.identity,
    qualificationClaim: fixture.qualificationClaim,
    coveredCampaignRegistrations: fixture.coveredCampaignRegistrations,
    activeCampaignRole: materialization.activeCampaignRole,
    campaigns: readback.campaigns.map((campaign) => ({
      role: campaign.role,
      campaignId: campaign.campaignId,
      sourceId: campaign.sourceId,
      entityCount: campaign.mappings.length,
      structure: campaign.structure
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
