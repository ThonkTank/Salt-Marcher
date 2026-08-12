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

describe('reward-v1 entropy stream encodings', () => {
  it('keeps every typed stream family byte-stable', () => {
    expect(encounterCandidateStream(179_974, 2, 'candidate')).toBe(
      '179974|encounter:2:candidate'
    )
    expect(rewardBudgetStream(179_974, 'magic-target', 1)).toBe(
      '179974|magic-target|1'
    )
    expect(treasurePlanningStream(179_974, 'theme', 2)).toBe('179974|theme|2')
    expect(slotRoleStream(179_974, 'treasure:1', 2)).toBe(
      '179974|loot-role:treasure:1|2'
    )
    expect(
      itemSelectionStream(179_974, 'loot-item', 'treasure:1', 2, 'item-x')
    ).toBe('179974|loot-item:treasure:1:2|item-x')
    expect(magicSelectionStream(179_974, 'curse', 'item-x', 3)).toBe(
      '179974|curse:item-x|3'
    )
    expect(packingStream(179_974, 'key', 'container-x')).toBe(
      '179974|container:key|container-x'
    )
  })
})
