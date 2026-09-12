import { randomUUID, createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import { z } from 'zod'
import {
  assertPartyHistoryMigration,
  assertPartyHistoryXp,
  readPartyHistoryEvidence,
  type PartyHistoryEvidence
} from '../../scripts/qualification/historical-party-history-evidence.js'
function snapshot(): PartyHistoryEvidence {
  return {
    installation: {
      party_history_installation: [{ singleton: 1, id: randomUUID() }],
      party_history_campaign: [],
      party_history_index: []
    },
    campaigns: [
      {
        id: 'campaign',
        tables: { party_action_history: [], party_action_receipt: [] }
      }
    ]
  }
}
it('preserves existing records and only creates absent migration tables', () => {
  const before = snapshot()
  before.installation['party_history_installation'] = null
  before.campaigns[0]!.tables['party_action_history'] = null
  const after = snapshot()
  expect(() => assertPartyHistoryMigration(before, after)).not.toThrow()
  after.installation['party_history_campaign'] = [
    { campaign_id: 'lost', epoch: 'x' }
  ]
  expect(() => assertPartyHistoryMigration(before, after)).toThrow()
})
function xp() {
  const before = snapshot(),
    after = structuredClone(before),
    id = randomUUID()
  const character = { id: randomUUID(), name: 'Mara 1', xp: 975 }
  const party = { revision: 3, members: [character] }
  const changed = { revision: 4, members: [{ ...character, xp: 1000 }] }
  const profile = (value: unknown) => ({
    registry: { activeCampaignId: 'campaign' },
    campaigns: [{ id: 'campaign', party: value }]
  })
  const scope = `${z.string().parse(before.installation['party_history_installation']![0]!['id'])}:campaign`
  after.campaigns[0]!.tables['party_action_history'] = [
    {
      sequence: 1,
      id,
      installation_id: scope,
      description: 'XP ändern',
      applied: 1,
      payload_json: JSON.stringify({
        party: [{ before: character, after: changed.members[0] }],
        scene: { assignments: [], created: [] },
        combat: [],
        travel: [],
        loot: [],
        preferences: null
      })
    }
  ]
  after.campaigns[0]!.tables['party_action_receipt'] = [
    {
      command_id: id,
      installation_id: scope,
      request_fingerprint: 'a'.repeat(64),
      result_json: JSON.stringify({
        characterId: character.id,
        party: changed
      }),
      pending: 0,
      preferences_json: null,
      sequence: 1
    }
  ]
  after.installation['party_history_index'] = [
    { campaign_id: 'campaign', epoch: scope, command_id: id, sequence: 1 }
  ]
  return {
    before,
    after,
    previous: profile(party),
    continued: profile(changed)
  }
}
it('accepts one linked XP change with the complete original Party result', () => {
  const p = xp()
  expect(() =>
    assertPartyHistoryXp(p.before, p.after, p.previous, p.continued)
  ).not.toThrow()
})
it.each([
  'missing-index',
  'pending-receipt',
  'lost-history',
  'changed-identity'
])('rejects %s', (kind) => {
  const p = xp()
  if (kind === 'missing-index') p.after.installation['party_history_index'] = []
  if (kind === 'pending-receipt')
    p.after.campaigns[0]!.tables['party_action_receipt']![0]!['pending'] = 1
  if (kind === 'lost-history')
    p.after.campaigns[0]!.tables['party_action_history'] = []
  if (kind === 'changed-identity')
    p.after.installation['party_history_installation']![0]!['id'] = randomUUID()
  expect(() =>
    assertPartyHistoryXp(p.before, p.after, p.previous, p.continued)
  ).toThrow()
})
it('reads real closed databases without changing bytes and distinguishes absent tables', () => {
  const root = mkdtempSync(join(tmpdir(), 'history-evidence-'))
  try {
    const directory = join(root, 'campaign-data/campaigns/campaign')
    mkdirSync(directory, { recursive: true })
    const trash = join(root, 'campaign-data/campaigns/.trash/old')
    mkdirSync(trash, { recursive: true })
    const paths = [
      join(root, 'campaign-data/installation.sqlite'),
      join(directory, 'campaign.sqlite'),
      join(trash, 'campaign.sqlite')
    ]
    for (const path of paths) {
      const db = new DatabaseSync(path)
      db.exec('CREATE TABLE unrelated(value TEXT);')
      if (path === paths[0])
        db.exec(
          `CREATE TABLE party_history_installation(singleton INTEGER, id TEXT); INSERT INTO party_history_installation VALUES (1, '${randomUUID()}');`
        )
      db.close()
    }
    const hash = (path: string) =>
      createHash('sha256').update(readFileSync(path)).digest('hex')
    const before = paths.map(hash)
    const result = readPartyHistoryEvidence(root)
    expect(result.installation['party_history_installation']).toHaveLength(1)
    expect(structuredClone(result)).toEqual(result)
    expect(result.campaigns.map((c) => c.id)).toEqual([
      '.trash/old',
      'campaign'
    ])
    expect(result.campaigns[0]!.tables['party_action_receipt']).toBeNull()
    expect(paths.map(hash)).toEqual(before)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
