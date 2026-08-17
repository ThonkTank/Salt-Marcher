import type { LedgerRewardPartyMember } from '../../shared/contracts/session-generation.js'

export type RewardPartySnapshot = Readonly<{
  party: readonly Readonly<{ level: number; count: number }>[]
  ledgerParty: readonly LedgerRewardPartyMember[]
}>

/**
 * Creates the one aggregate party view from the raw reward-member snapshots.
 * Callers never maintain level counts independently from the ledger basis.
 */
export function assembleRewardParty(
  members: readonly LedgerRewardPartyMember[]
): RewardPartySnapshot {
  const counts = new Map<number, number>()
  for (const member of members)
    counts.set(member.level, (counts.get(member.level) ?? 0) + 1)
  return Object.freeze({
    party: Object.freeze(
      [...counts.entries()]
        .toSorted(([left], [right]) => left - right)
        .map(([level, count]) => Object.freeze({ level, count }))
    ),
    ledgerParty: Object.freeze(members.map((member) => Object.freeze(member)))
  })
}
