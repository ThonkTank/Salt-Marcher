import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDefaultCampaignSchemaBootstrapper } from '../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../src/core/persistence/sqlite/database.js'
import { validateCurrentFormatCampaignManifest } from './qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatCompletionFixture } from './qualification/current-format-completion-fixture.js'
import {
  interruptCurrentFormatCompletionFixture,
  reconcileCurrentFormatCompletionFixture
} from './qualification/current-format-completion-materializer.js'
import {
  assertCurrentFormatCompletionReadback,
  assertCurrentFormatCompletionReceipt,
  readCurrentFormatCompletionFixture
} from './qualification/current-format-completion-readback.js'
import { loadCurrentFormatEconomyFixture } from './qualification/current-format-economy-fixture.js'
import { loadCurrentFormatLiveFixture } from './qualification/current-format-live-fixture.js'
import { loadCurrentFormatPreparationFixture } from './qualification/current-format-preparation-fixture.js'
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
const economyFixture = loadCurrentFormatEconomyFixture(
  'docs/project/evidence/frontend-robustness-current-format-economy-fixture.v1.json',
  manifest,
  preparationFixture,
  spatialFixture
)
const completionFixture = loadCurrentFormatCompletionFixture(
  'docs/project/evidence/frontend-robustness-current-format-completion-fixture.v1.json',
  manifest,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture,
  economyFixture
)
const interrupted = interruptCurrentFormatCompletionFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture,
  economyFixture,
  completionFixture
)
const reconciled = reconcileCurrentFormatCompletionFixture(
  dataRoot,
  rootFixture,
  spatialFixture,
  completionFixture
)
const readback = readCurrentFormatCompletionFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture,
  economyFixture,
  completionFixture
)
assertCurrentFormatCompletionReadback(
  rootFixture,
  spatialFixture,
  preparationFixture,
  economyFixture,
  completionFixture,
  readback
)
assertCurrentFormatCompletionReceipt(reconciled, readback)

process.stdout.write(
  `${JSON.stringify({
    kind: 'current-format-completion-qualification',
    fixtureIdentity: completionFixture.identity,
    qualificationClaim: completionFixture.qualificationClaim,
    campaignOwnerCount: manifest.campaignOwners.length,
    installationAuthorityCount: manifest.installationDependencies.length,
    interrupted: interrupted.campaigns.map((campaign) => ({
      role: campaign.role,
      provisionalStatus: campaign.provisionalStatus,
      provisionalFailureDetail: campaign.provisionalFailureDetail
    })),
    campaigns: readback.campaigns.map((campaign) => ({
      role: campaign.role,
      campaignId: campaign.campaignId,
      commandId: campaign.receipt.commandId,
      locationId: campaign.location.id,
      locationRevision: campaign.receipt.snapshot.revision,
      mapContentRevision: campaign.placement.contentRevision,
      semanticSha256: campaign.semanticSha256
    })),
    exactOnePrimaryCoverage: true,
    semanticReadback: true
  })}\n`
)

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = process.argv[index + 1]
  if (index < 0 || !value) throw new Error(`${name} is required`)
  return value
}
