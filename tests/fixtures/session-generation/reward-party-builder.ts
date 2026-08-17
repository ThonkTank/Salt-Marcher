import type { LedgerRewardPartyMember } from '../../../src/shared/contracts/session-generation.js'
import { defaultGeneratorConfig } from '../../../src/shared/generator/system-generator-preset.js'

/** Canonical valid reward party fixture shared by stage and store tests. */
export function buildRewardLedger(
  party: readonly Readonly<{ level: number; count: number }>[],
  overrides: Readonly<{
    currentXp?: number
    currentNonMagicCp?: number
    ledgerRevision?: number
  }> = {}
): LedgerRewardPartyMember[] {
  let ordinal = 0
  return party.flatMap((entry) => {
    const progression =
      defaultGeneratorConfig.loot.progression[entry.level - 1]!
    return Array.from({ length: entry.count }, () => {
      ordinal += 1
      return {
        characterId: `018f47db-e17a-7000-8000-${String(ordinal).padStart(12, '0')}`,
        level: entry.level,
        currentXp: overrides.currentXp ?? progression.xpAtLevel,
        ledgerRevision: overrides.ledgerRevision ?? 0,
        currentNonMagicCp:
          overrides.currentNonMagicCp ?? progression.goldAtLevelCp,
        currentMagic: {
          Common: 0,
          Uncommon: 0,
          Rare: 0,
          'Very Rare': 0,
          Legendary: 0
        }
      }
    })
  })
}
