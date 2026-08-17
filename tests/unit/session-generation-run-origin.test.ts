import { describe, expect, it } from 'vitest'
import {
  groupRewardRunOriginFingerprint,
  sessionRunOriginFingerprint,
  type GroupRewardRunOrigin,
  type SessionRunOrigin
} from '../../src/core/session-generation/run-origin.js'

const hashA = 'a'.repeat(64)
const hashB = 'b'.repeat(64)
const ledgerParty = [
  {
    characterId: '01900000-0000-7000-8000-000000000099',
    level: 3,
    currentXp: 900,
    ledgerRevision: 1,
    currentNonMagicCp: 0,
    currentMagic: {
      Common: 0,
      Uncommon: 0,
      Rare: 0,
      'Very Rare': 0,
      Legendary: 0
    }
  }
]

describe('generated run semantic origins', () => {
  it('excludes workflow identity and changes for every session meaning input', () => {
    const origin: SessionRunOrigin = {
      encounterEngineVersion: 'encounter-v1',
      rewardEngineVersion: 'reward-v1',
      catalogContentHash: hashA,
      generatorPreset: {
        id: '01900000-0000-7000-8000-000000000001',
        revision: 3,
        configHash: hashA
      },
      input: {
        party: [{ level: 3, count: 4 }],
        ledgerParty,
        adventureDayFraction: '0.6',
        encounterCount: 3,
        seed: 42
      }
    }
    const fingerprint = sessionRunOriginFingerprint(origin)
    expect(
      sessionRunOriginFingerprint({
        ...origin,
        operationId: 'ignored-a'
      } as SessionRunOrigin & { operationId: string })
    ).toBe(fingerprint)
    for (const changed of [
      { ...origin, encounterEngineVersion: 'encounter-v2' },
      { ...origin, rewardEngineVersion: 'reward-v2' },
      { ...origin, catalogContentHash: hashB },
      {
        ...origin,
        generatorPreset: { ...origin.generatorPreset, revision: 4 }
      },
      {
        ...origin,
        generatorPreset: { ...origin.generatorPreset, configHash: hashB }
      },
      { ...origin, input: { ...origin.input, seed: 43 } }
    ])
      expect(sessionRunOriginFingerprint(changed)).not.toBe(fingerprint)
  })

  it('changes group reward identity for policy and persisted revisions', () => {
    const origin: GroupRewardRunOrigin = {
      rewardEngineVersion: 'reward-v1',
      catalogContentHash: hashA,
      input: {
        party: [{ level: 3, count: 4 }],
        ledgerParty,
        sceneId: '01900000-0000-7000-8000-000000000010',
        groupId: '01900000-0000-7000-8000-000000000011',
        sceneRevision: 2,
        groupRevision: 3,
        groupEntries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 0 }],
        partyRevision: 4,
        campaignRulesRevision: 5,
        rewardXpBasis: 'base',
        baseXp: 200,
        adjustedXp: 400,
        rewardXp: 200,
        seed: 42
      }
    }
    const fingerprint = groupRewardRunOriginFingerprint(origin)
    expect(
      groupRewardRunOriginFingerprint({
        ...origin,
        commandId: 'ignored'
      } as GroupRewardRunOrigin & { commandId: string })
    ).toBe(fingerprint)
    for (const input of [
      { ...origin.input, groupRevision: 4 },
      { ...origin.input, sceneRevision: 3 },
      { ...origin.input, partyRevision: 5 },
      {
        ...origin.input,
        campaignRulesRevision: 6,
        rewardXpBasis: 'adjusted' as const,
        rewardXp: 400
      }
    ])
      expect(groupRewardRunOriginFingerprint({ ...origin, input })).not.toBe(
        fingerprint
      )
  })
})
