import assert from 'node:assert/strict'
import { z } from 'zod'
import type { PartyHistoryEvidence } from './historical-party-history-evidence.js'

const installationTables = [
  'party_history_installation',
  'party_history_campaign',
  'party_history_index'
] as const
const campaignTables = ['party_action_history', 'party_action_receipt'] as const

export function assertPartyHistoryMigration(
  before: PartyHistoryEvidence,
  after: PartyHistoryEvidence
) {
  const expected = structuredClone(before)
  for (const table of installationTables) {
    if (expected.installation[table] !== null) continue
    if (table === 'party_history_installation') {
      const identity = z
        .array(z.object({ singleton: z.literal(1), id: z.uuid() }).strict())
        .length(1)
        .parse(after.installation[table])
      expected.installation[table] = identity
    } else expected.installation[table] = []
  }
  for (const campaign of expected.campaigns) {
    for (const table of campaignTables)
      if (campaign.tables[table] === null) campaign.tables[table] = []
  }
  assert.deepEqual(after, expected)
}

/** Accept one fully linked XP command; all prior records must remain identical. */
export function assertPartyHistoryXp(
  before: PartyHistoryEvidence,
  after: PartyHistoryEvidence,
  beforeProfile: unknown,
  afterProfile: unknown
) {
  const profile = z
    .object({
      registry: z.object({ activeCampaignId: z.string() }),
      campaigns: z.array(
        z
          .object({
            id: z.string(),
            party: z
              .object({
                members: z.array(z.object({ id: z.string() }).passthrough())
              })
              .passthrough()
          })
          .passthrough()
      )
    })
    .passthrough()
  const previous = profile.parse(beforeProfile)
  const continued = profile.parse(afterProfile)
  const campaignId = previous.registry.activeCampaignId
  const oldParty = previous.campaigns.find((c) => c.id === campaignId)!.party
  const newParty = continued.campaigns.find((c) => c.id === campaignId)!.party
  assert.equal(oldParty.members.length, 1)
  const expected = structuredClone(before)
  const oldCampaign = expected.campaigns.find((c) => c.id === campaignId)!
  const newCampaign = after.campaigns.find((c) => c.id === campaignId)!
  const newRows = (name: string) => {
    const old = oldCampaign.tables[name]!
    const rows = newCampaign.tables[name]!
    assert.equal(rows.length, old.length + 1)
    for (const row of old)
      assert(rows.some((r) => JSON.stringify(r) === JSON.stringify(row)))
    return rows.filter(
      (r) => !old.some((row) => JSON.stringify(r) === JSON.stringify(row))
    )
  }
  const history = newRows('party_action_history')[0]!
  const receipt = newRows('party_action_receipt')[0]!
  z.uuid().parse(history['id'])
  assert.equal(history['description'], 'XP ändern')
  assert.equal(history['applied'], 1)
  assert.deepEqual(JSON.parse(z.string().parse(history['payload_json'])), {
    party: [{ before: oldParty.members[0], after: newParty.members[0] }],
    scene: { assignments: [], created: [] },
    combat: [],
    travel: [],
    loot: [],
    preferences: null
  })
  assert.equal(receipt['command_id'], history['id'])
  assert.equal(receipt['installation_id'], history['installation_id'])
  const installation = z
    .array(z.object({ singleton: z.literal(1), id: z.uuid() }).strict())
    .length(1)
    .parse(after.installation['party_history_installation'])[0]!
  const epoch =
    after.installation['party_history_campaign']!.find(
      (row) => row['campaign_id'] === campaignId
    )?.['epoch'] ?? campaignId
  assert.equal(
    history['installation_id'],
    `${installation.id}:${z.string().parse(epoch)}`
  )

  assert.equal(receipt['sequence'], history['sequence'])
  assert.equal(receipt['pending'], 0)
  assert.equal(receipt['preferences_json'], null)
  assert.deepEqual(JSON.parse(z.string().parse(receipt['result_json'])), {
    characterId: oldParty.members[0]!.id,
    party: newParty
  })
  assert.match(
    z.string().parse(receipt['request_fingerprint']),
    /^[a-f0-9]{64}$/
  )
  const index = after.installation['party_history_index']!
  const oldIndex = before.installation['party_history_index']!
  const added = index.filter(
    (row) => !oldIndex.some((r) => JSON.stringify(r) === JSON.stringify(row))
  )
  assert.equal(added.length, 1)
  assert.deepEqual(added[0], {
    campaign_id: campaignId,
    epoch: history['installation_id'],
    command_id: history['id'],
    sequence: history['sequence']
  })
  expected.installation['party_history_index'] = [...oldIndex, added[0]].sort(
    (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))
  )
  oldCampaign.tables['party_action_history'] =
    newCampaign.tables['party_action_history']!
  oldCampaign.tables['party_action_receipt'] =
    newCampaign.tables['party_action_receipt']!
  assert.deepEqual(after, expected)
}
