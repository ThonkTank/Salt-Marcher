import { z } from 'zod'
import { CampaignImportService } from '../../src/core/campaign-import/campaign-import-service.js'
import { creatures } from '../../src/core/creatures/catalog.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import type { CampaignImportApplyResult } from '../../src/shared/contracts/campaign-import.js'
import type {
  CurrentFormatCampaignRole,
  CurrentFormatRootFixture
} from './current-format-root-fixture.js'

const materializedCampaignSchema = z
  .object({
    role: z.enum(['A', 'B']),
    campaignId: z.uuid(),
    sourceId: z.string().min(1)
  })
  .strict()

const materializationReceiptSchema = z
  .object({
    fixtureIdentity: z.literal('frontend-robustness-current-format-root-v1'),
    qualificationClaim: z.literal(
      'partial-fr2f2a-root-cohort-not-complete-current-format'
    ),
    campaigns: z.array(materializedCampaignSchema).length(2),
    activeCampaignRole: z.literal('A')
  })
  .strict()

export type CurrentFormatRootMaterializationReceipt = Readonly<
  z.infer<typeof materializationReceiptSchema>
>

const creatureReferences = new Map(
  creatures.map((creature) => [
    creature.id,
    { id: creature.id, displayName: creature.name }
  ])
)

export function materializeCurrentFormatRootFixture(
  dataRoot: string,
  fixture: CurrentFormatRootFixture
): CurrentFormatRootMaterializationReceipt {
  const campaigns = new CampaignStore(dataRoot)
  try {
    const initial = campaigns.list()
    if (
      initial.activeCampaignId !== null ||
      initial.campaigns.length !== 0 ||
      initial.trashedCampaigns.length !== 0
    )
      throw new Error(
        'Current-format root materialization requires an empty installation.'
      )

    const importer = new CampaignImportService(campaigns, {
      resolve: (id) => creatureReferences.get(id) ?? null
    })
    for (const campaign of fixture.campaigns) {
      const report = importer.validate(campaign.bundle)
      if (!report.valid)
        throw new Error(
          `Current-format root Campaign ${campaign.role} failed preflight: ${report.conflicts
            .map(({ code }) => code)
            .join(',')}`
        )
    }
    const materialized = fixture.campaigns.map(({ role, bundle }) => ({
      role,
      sourceId: bundle.source.id,
      result: importer.apply(bundle)
    }))
    for (const campaign of materialized)
      assertApplied(campaign.role, campaign.result)

    const campaignA = materialized.find(({ role }) => role === 'A')!
    campaigns.activate(campaignA.result.campaignId)
    const final = campaigns.list()
    if (final.activeCampaignId !== campaignA.result.campaignId)
      throw new Error('Current-format root materializer did not activate A.')
    if (final.campaigns.length !== fixture.campaigns.length)
      throw new Error(
        'Current-format root materializer published an unexpected Campaign count.'
      )

    return materializationReceiptSchema.parse({
      fixtureIdentity: fixture.identity,
      qualificationClaim: fixture.qualificationClaim,
      campaigns: materialized.map(({ role, sourceId, result }) => ({
        role,
        campaignId: result.campaignId,
        sourceId
      })),
      activeCampaignRole: 'A'
    })
  } finally {
    campaigns.close()
  }
}

function assertApplied(
  role: CurrentFormatCampaignRole,
  result: CampaignImportApplyResult
): void {
  if (result.status !== 'applied')
    throw new Error(
      `Current-format root Campaign ${role} was not freshly applied.`
    )
}
