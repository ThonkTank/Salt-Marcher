import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CampaignStore,
  type CampaignReplacePhase
} from '../../src/core/persistence/sqlite/campaign-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'

const roots: string[] = []

const rollbackPhases = [
  'before-original-move',
  'after-original-move',
  'before-replacement-promote',
  'after-replacement-promote',
  'before-replacement-open',
  'after-replacement-open',
  'before-registry-commit'
] as const satisfies readonly CampaignReplacePhase[]

const rollForwardPhases = [
  'after-registry-commit',
  'before-cleanup',
  'after-cleanup'
] as const satisfies readonly CampaignReplacePhase[]

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('campaign replacement safety', () => {
  it.each(['active', 'inactive'] as const)(
    'preserves the original for every uncommitted boundary of an %s campaign',
    (activity) => {
      for (const failurePhase of rollbackPhases)
        assertFailureConverges(activity, failurePhase, false)
    }
  )

  it.each(['active', 'inactive'] as const)(
    'preserves the verified replacement after registry commit for an %s campaign',
    (activity) => {
      for (const failurePhase of rollForwardPhases)
        assertFailureConverges(activity, failurePhase, true)
    }
  )
})

function assertFailureConverges(
  activity: 'active' | 'inactive',
  failurePhase: CampaignReplacePhase,
  committed: boolean
): void {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-replacement-'))
  roots.push(root)
  let armed = true
  const campaigns = new CampaignStore(root, {
    onReplacePhase(phase) {
      if (armed && phase === failurePhase) {
        armed = false
        throw new Error(`injected ${phase}`)
      }
    }
  })
  const targetId = campaigns.create('Original Registry').activeCampaignId!
  const party = new PartyStore(campaigns.activeCampaignDatabase())
  party.create(member('Original Domain'), party.read().revision)
  campaigns.activeCampaignDatabase().pragma('wal_checkpoint(FULL)')
  const originalHash = fileHash(campaignPath(root, targetId))
  const otherId = campaigns.create('Other Campaign').activeCampaignId!
  if (activity === 'active') campaigns.activate(targetId)

  expect(() =>
    campaigns.stageImportedCampaign(
      'Replacement Registry',
      targetId,
      (staged) => {
        staged
          .prepare("UPDATE player_characters SET name = 'Replacement Domain'")
          .run()
      }
    )
  ).toThrow(`injected ${failurePhase}`)

  assertState(
    campaigns,
    targetId,
    committed ? targetId : activity === 'active' ? targetId : otherId,
    committed ? 'Replacement Registry' : 'Original Registry',
    committed ? 'Replacement Domain' : 'Original Domain'
  )
  if (committed)
    expect(fileHash(campaignPath(root, targetId))).not.toBe(originalHash)
  else expect(fileHash(campaignPath(root, targetId))).toBe(originalHash)
  campaigns.close()

  const restarted = new CampaignStore(root)
  assertState(
    restarted,
    targetId,
    committed ? targetId : activity === 'active' ? targetId : otherId,
    committed ? 'Replacement Registry' : 'Original Registry',
    committed ? 'Replacement Domain' : 'Original Domain'
  )
  restarted.visitCampaignDatabases(({ database }) => {
    expect(database.pragma('quick_check', { simple: true })).toBe('ok')
  })
  restarted.close()
}

function assertState(
  campaigns: CampaignStore,
  targetId: string,
  activeId: string,
  registryName: string,
  domainName: string
): void {
  const snapshot = campaigns.list()
  expect(snapshot.activeCampaignId).toBe(activeId)
  expect(snapshot.campaigns.find(({ id }) => id === targetId)).toMatchObject({
    id: targetId,
    name: registryName
  })
  const target = campaigns
    .visitCampaignDatabases(({ id, database }) =>
      id === targetId ? new PartyStore(database).read().members : null
    )
    .find((value) => value !== null)
  expect(target).toEqual([expect.objectContaining({ name: domainName })])
}

function member(name: string) {
  return {
    name,
    playerName: null,
    species: null,
    characterClass: null,
    languages: [],
    level: null,
    passivePerception: null,
    passiveInvestigation: null,
    passiveInsight: null,
    armorClass: null,
    movementSpeedFeet: null
  }
}

function campaignPath(root: string, id: string): string {
  return join(root, 'campaigns', id, 'campaign.sqlite')
}

function fileHash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
