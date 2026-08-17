import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  encounterCandidateStream,
  itemSelectionStream,
  magicSelectionStream,
  packingStream,
  rewardBudgetStream,
  slotRoleStream,
  treasurePlanningStream
} from '../../src/core/session-generation/entropy-streams.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'

describe('versioned entropy stream encodings', () => {
  it('keeps every typed stream family byte-stable', () => {
    expect(encounterCandidateStream(179_974, 2, 'candidate')).toBe(
      '179974|encounter:2:candidate'
    )
    expect(rewardBudgetStream(179_974, 'magic-target', 1)).toBe(
      'reward-v3|179974|magic-target|1'
    )
    expect(treasurePlanningStream(179_974, 'theme', 2)).toBe(
      'reward-v3|179974|theme|2'
    )
    expect(slotRoleStream(179_974, 'treasure:1', 2)).toBe(
      'reward-v3|179974|loot-role:treasure:1|2'
    )
    expect(
      itemSelectionStream(179_974, 'loot-item', 'treasure:1', 2, 'item-x')
    ).toBe('reward-v3|179974|loot-item:treasure:1:2|item-x')
    expect(magicSelectionStream(179_974, 'curse', 'item-x', 3)).toBe(
      'reward-v3|179974|curse:item-x|3'
    )
    expect(packingStream(179_974, 'key', 'container-x')).toBe(
      'reward-v3|179974|container:key|container-x'
    )
  })

  it('salts reward entropy only with the Reward engine version', () => {
    const stream = rewardBudgetStream(17, 'magic-target', 2)
    const expected =
      createHash('sha256').update(stream).digest().readUInt32BE(0) % 97
    expect(sha256EncounterEntropy.modulo(stream, 97)).toBe(expected)
    const source = readFileSync(
      'src/utility/session-generation/sha256-entropy.ts',
      'utf8'
    )
    expect(source).not.toContain('SESSION_GENERATION_ENGINE_VERSION')
    expect(source).toContain('SESSION_ENCOUNTER_ENGINE_VERSION')
  })
})
