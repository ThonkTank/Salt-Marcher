import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDefaultCampaignSchemaBootstrapper } from '../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../src/core/persistence/sqlite/database.js'
import { validateCurrentFormatCampaignManifest } from './qualification/current-format-campaign-manifest.js'
import {
  assertCurrentFormatEconomyReadback,
  assertCurrentFormatEconomyReceipt,
  readCurrentFormatEconomyFixture
} from './qualification/current-format-economy-readback.js'
import { loadCurrentFormatEconomyFixture } from './qualification/current-format-economy-fixture.js'
import { materializeCurrentFormatEconomyFixture } from './qualification/current-format-economy-materializer.js'
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
const receipt = materializeCurrentFormatEconomyFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture,
  economyFixture
)
const readback = readCurrentFormatEconomyFixture(
  dataRoot,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture,
  economyFixture
)
assertCurrentFormatEconomyReadback(
  rootFixture,
  spatialFixture,
  preparationFixture,
  economyFixture,
  readback
)
assertCurrentFormatEconomyReceipt(receipt, readback)

process.stdout.write(
  `${JSON.stringify({
    kind: 'current-format-economy-qualification',
    fixtureIdentity: economyFixture.identity,
    qualificationClaim: economyFixture.qualificationClaim,
    coveredCampaignRegistrations: economyFixture.coveredCampaignRegistrations,
    coveredInstallationAuthorities:
      economyFixture.coveredInstallationAuthorities,
    activeCampaignRole: receipt.activeCampaignRole,
    installation: {
      settingsRevision: readback.installation.settings.revision,
      locationSymbolRevision: readback.installation.symbols.revision,
      systemBiomeIds: readback.installation.systemBiomes.map(({ id }) => id)
    },
    campaigns: readback.campaigns.map((campaign) => ({
      role: campaign.role,
      campaignId: campaign.campaignId,
      locationRevision: campaign.locations.revision,
      lootProjectionRevision: campaign.inbox.revision,
      manualTreasureId: campaign.manualTreasure.id,
      acceptedTreasureId: campaign.acceptedTreasure.id,
      ledgerRevision: campaign.ledger.revision,
      ledgerEntryCount: campaign.ledger.entries.length,
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
