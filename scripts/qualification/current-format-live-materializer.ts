import type Database from 'better-sqlite3'
import { z } from 'zod'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import { materializeCurrentFormatRootFixture } from './current-format-root-materializer.js'
import type {
  CurrentFormatLiveCampaign,
  CurrentFormatLiveFixture
} from './current-format-live-fixture.js'

const liveCampaignReceiptSchema = z
  .object({
    role: z.enum(['A', 'B']),
    campaignId: z.uuid(),
    sceneId: z.uuid(),
    addedInactivePartyId: z.uuid(),
    groupIds: z.array(z.uuid()).min(2),
    combatId: z.uuid()
  })
  .strict()

const liveMaterializationReceiptSchema = z
  .object({
    fixtureIdentity: z.literal('frontend-robustness-current-format-live-v1'),
    qualificationClaim: z.literal(
      'partial-fr2f2b1-live-cohort-not-complete-current-format'
    ),
    campaigns: z.array(liveCampaignReceiptSchema).length(2),
    activeCampaignRole: z.literal('A')
  })
  .strict()

export type CurrentFormatLiveMaterializationReceipt = Readonly<
  z.infer<typeof liveMaterializationReceiptSchema>
>

export function materializeCurrentFormatLiveFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture
): CurrentFormatLiveMaterializationReceipt {
  const rootReceipt = materializeCurrentFormatRootFixture(dataRoot, rootFixture)
  const rootCampaigns = new Map(
    rootReceipt.campaigns.map((campaign) => [campaign.role, campaign])
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const before = campaigns.list()
    const receipts = liveFixture.campaigns.map((configured) => {
      const rootCampaign = rootCampaigns.get(configured.role)
      if (!rootCampaign)
        throw new Error(
          `Current-format live Campaign ${configured.role} is missing its root receipt.`
        )
      const receipt = campaigns.visitCampaignDatabase(
        rootCampaign.campaignId,
        (database) =>
          materializeCampaign(
            campaigns,
            database,
            rootCampaign.sourceId,
            rootCampaign.campaignId,
            configured
          )
      )
      if (!receipt)
        throw new Error(
          `Current-format live Campaign ${configured.role} database is unavailable.`
        )
      return receipt
    })
    const after = campaigns.list()
    if (
      after.activeCampaignId !== before.activeCampaignId ||
      after.revision !== before.revision
    )
      throw new Error(
        'Current-format live materialization changed Campaign switch authority.'
      )
    return liveMaterializationReceiptSchema.parse({
      fixtureIdentity: liveFixture.identity,
      qualificationClaim: liveFixture.qualificationClaim,
      campaigns: receipts,
      activeCampaignRole: 'A'
    })
  } finally {
    campaigns.close()
  }
}

function materializeCampaign(
  campaigns: CampaignStore,
  database: Database.Database,
  sourceId: string,
  campaignId: string,
  configured: CurrentFormatLiveCampaign
) {
  const access = fixedSqliteDatabaseAccess(database)
  const play = new LivePlayService(access)
  const mappings = campaigns
    .campaignImportRepository()
    .entityMappings(database, sourceId)
  const mappedId = (
    kind: 'party' | 'locations',
    externalKey: string
  ): string => {
    const mapping = mappings.find(
      (candidate) =>
        candidate.kind === kind && candidate.externalKey === externalKey
    )
    if (!mapping)
      throw new Error(
        `Current-format live Campaign ${configured.role} is missing ${kind}:${externalKey}.`
      )
    return mapping.internalId
  }

  let party = play.readParty()
  party = play.createPartyCharacter(
    configured.materialization.addedInactiveParty.draft,
    party.revision
  )
  const inactive = party.members.find(
    ({ name }) =>
      name === configured.materialization.addedInactiveParty.draft.name
  )
  if (!inactive || inactive.active)
    throw new Error(
      `Current-format live Campaign ${configured.role} did not create its inactive Party sentinel.`
    )

  let session = play.readSession()
  const sceneId = session.scene.focusedSceneId
  session = play.setSceneLocation(
    sceneId,
    mappedId(
      'locations',
      configured.materialization.focusedLocationExternalKey
    ),
    session.scene.revision
  )
  for (const externalKey of configured.materialization
    .importedActivePartyExternalKeys) {
    const partyMemberId = mappedId('party', externalKey)
    const member = party.members.find(({ id }) => id === partyMemberId)
    if (!member?.active)
      throw new Error(
        `Current-format live Campaign ${configured.role} Party ${externalKey} is not active.`
      )
    const scene = session.scene.scenes.find(({ id }) => id === sceneId)
    if (!scene?.partyMemberIds.includes(partyMemberId))
      session = play.assignScenePartyMember(
        sceneId,
        partyMemberId,
        true,
        session.scene.revision
      )
  }

  const groupIds = new Map<string, string>()
  for (const group of configured.materialization.groups) {
    const result = play.saveSceneGroup(
      sceneId,
      null,
      group.name,
      group.note,
      group.disposition,
      group.entries,
      session.scene.revision,
      null
    )
    const saved = result.scenePatch.upsertedGroups.find(
      ({ name }) => name === group.name
    )
    if (!saved)
      throw new Error(
        `Current-format live Campaign ${configured.role} did not save Group ${group.semanticKey}.`
      )
    groupIds.set(group.semanticKey, saved.id)
    session = play.readSession()
    if (group.archived) {
      play.setSceneGroupArchived(sceneId, saved.id, true, saved.revision)
      session = play.readSession()
    }
  }

  const combatGroupId = groupIds.get(
    configured.materialization.combatGroupSemanticKey
  )
  if (!combatGroupId)
    throw new Error(
      `Current-format live Campaign ${configured.role} has no materialized Combat Group.`
    )
  const combat = play.prepareCombat(sceneId, session.scene.revision, [
    combatGroupId
  ]).combat
  if (!combat || combat.phase !== 'initiative')
    throw new Error(
      `Current-format live Campaign ${configured.role} did not enter initiative.`
    )

  return liveCampaignReceiptSchema.parse({
    role: configured.role,
    campaignId,
    sceneId,
    addedInactivePartyId: inactive.id,
    groupIds: [...groupIds.values()],
    combatId: combat.id
  })
}
