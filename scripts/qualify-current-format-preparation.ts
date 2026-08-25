import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDefaultCampaignSchemaBootstrapper } from '../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../src/core/persistence/sqlite/database.js'
import { validateCurrentFormatCampaignManifest } from './qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatLiveFixture } from './qualification/current-format-live-fixture.js'
import { loadCurrentFormatPreparationFixture } from './qualification/current-format-preparation-fixture.js'
import { materializeCurrentFormatPreparationFixture } from './qualification/current-format-preparation-materializer.js'
import {
  assertCurrentFormatPreparationReadback,
  assertCurrentFormatPreparationReceipt,
  readCurrentFormatPreparationFixture
} from './qualification/current-format-preparation-readback.js'
import { loadCurrentFormatRootFixture } from './qualification/current-format-root-fixture.js'
import { loadCurrentFormatSpatialFixture } from './qualification/current-format-spatial-fixture.js'

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
const preparationFixture = loadCurrentFormatPreparationFixture(
  'docs/project/evidence/frontend-robustness-current-format-preparation-fixture.v1.json',
  manifest,
  spatialFixture
)
const receipt = materializeCurrentFormatPreparationFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture
)
const readback = readCurrentFormatPreparationFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture
)
assertCurrentFormatPreparationReadback(
  rootFixture,
  spatialFixture,
  preparationFixture,
  readback
)
assertCurrentFormatPreparationReceipt(receipt, readback)

process.stdout.write(
  `${JSON.stringify({
    kind: 'current-format-preparation-qualification',
    fixtureIdentity: preparationFixture.identity,
    qualificationClaim: preparationFixture.qualificationClaim,
    coveredCampaignRegistrations:
      preparationFixture.coveredCampaignRegistrations,
    coveredInstallationAuthorities:
      preparationFixture.coveredInstallationAuthorities,
    activeCampaignRole: receipt.activeCampaignRole,
    installation: {
      presetRegistryRevision: readback.installation.presetRegistryRevision,
      encounterTableRevision:
        readback.installation.sharedEncounterTables.revision
    },
    campaigns: readback.campaigns.map((campaign) => ({
      role: campaign.role,
      campaignId: campaign.campaignId,
      presetId: campaign.preset.assignment?.effectivePresetId,
      rulesRevision: campaign.rules.revision,
      plannerRevision: campaign.workspace.session.revision,
      preparationStatus: campaign.preparation.status,
      runId: campaign.generatedRun.id,
      encounterPlanCount: campaign.workspace.session.scenes.filter(
        ({ encounterPlanId }) => encounterPlanId !== null
      ).length,
      generatedRewardCount: campaign.workspace.session.scenes.flatMap(
        ({ generatedRewards }) => generatedRewards
      ).length,
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
