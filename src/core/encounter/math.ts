import type { PartyMember } from '../../shared/contracts/live-session.js'
import { baseEncounterMultiplier } from './xp-multipliers.js'
export const thresholds = [
  [25, 50, 75, 100],
  [50, 100, 150, 200],
  [75, 150, 225, 400],
  [125, 250, 375, 500],
  [250, 500, 750, 1100],
  [300, 600, 900, 1400],
  [350, 750, 1100, 1700],
  [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400],
  [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500],
  [1100, 2200, 3400, 5100],
  [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200],
  [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500],
  [2400, 4900, 7300, 10900],
  [2800, 5700, 8500, 12700]
] as const
export function partyThresholds(
  party: readonly PartyMember[]
): readonly number[] {
  return party
    .filter(
      (p): p is PartyMember & { level: number } => p.active && p.level !== null
    )
    .reduce(
      (sum, p) => sum.map((v, i) => v + thresholds[p.level - 1]![i]!),
      [0, 0, 0, 0]
    )
}
export function multiplier(count: number, partySize: number): number {
  let m = baseEncounterMultiplier(count)
  if (partySize < 3) m = baseEncounterMultiplier(count) + (count > 14 ? 1 : 0.5)
  if (partySize > 5 && m > 1)
    m = [1, 1, 1.5, 2, 2.5, 3][[1, 1.5, 2, 2.5, 3, 4].indexOf(m)] ?? m
  return m
}
export function difficulty(
  adjusted: number,
  values: readonly number[]
): string {
  return adjusted >= values[3]!
    ? 'Deadly'
    : adjusted >= values[2]!
      ? 'Hard'
      : adjusted >= values[1]!
        ? 'Medium'
        : adjusted >= values[0]!
          ? 'Easy'
          : 'Trivial'
}
