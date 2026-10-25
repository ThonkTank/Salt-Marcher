// Cumulative reward guidance from SaltMarcher's reward-budget-stage; no generation or random rounding.
import {
  add,
  decimal,
  multiply,
  rational,
  subtract,
  roundHalfUp,
  toNumber,
  type Rational,
} from './rational';
import { budgetRarities, type BudgetRarity } from '../atlas/dungeon-budget-contracts';
export interface RewardProgression {
  level: number;
  xpAtLevel: number;
  goldAtLevelCp: number;
  magicPerXp: Record<BudgetRarity, number>;
}
export interface RewardGuidanceRules {
  progression: RewardProgression[];
}
function goldTargetAtXp(xp: number, rules: RewardGuidanceRules): Rational {
  const rows = rules.progression,
    last = rows.at(-1)!;
  if (xp >= last.xpAtLevel) return rational(BigInt(last.goldAtLevelCp));
  const lower = rows.find(
    (row, index) => row.xpAtLevel <= xp && (rows[index + 1]?.xpAtLevel ?? Infinity) > xp,
  )!;
  const upper = rows[rows.indexOf(lower) + 1]!;
  const span = upper.xpAtLevel - lower.xpAtLevel;
  return add(
    rational(BigInt(lower.goldAtLevelCp)),
    multiply(
      rational(BigInt(upper.goldAtLevelCp - lower.goldAtLevelCp)),
      rational(BigInt(xp - lower.xpAtLevel), BigInt(span)),
    ),
  );
}
function magicTargetAtXp(xp: number, rarity: BudgetRarity, rules: RewardGuidanceRules): Rational {
  return rules.progression.slice(0, -1).reduce((sum, row, index) => {
    const upper = rules.progression[index + 1]?.xpAtLevel ?? xp;
    const amount = Math.max(0, Math.min(xp, upper) - row.xpAtLevel);
    return add(sum, multiply(rational(BigInt(amount)), decimal(String(row.magicPerXp[rarity]))));
  }, rational(0n));
}
export function rewardGuidance(
  level: number,
  partySize: number,
  rewardXp: number,
  rules: RewardGuidanceRules,
) {
  const start = rules.progression.find((r) => r.level === level)?.xpAtLevel;
  if (start === undefined)
    throw new Error('Beute-Preset besitzt für das Ziellevel keine Fortschrittszeile.');
  const perCharacter = Math.floor(rewardXp / partySize),
    after = start + perCharacter;
  return {
    goldCopper: String(
      roundHalfUp(
        multiply(
          subtract(goldTargetAtXp(after, rules), goldTargetAtXp(start, rules)),
          rational(BigInt(partySize)),
        ),
      ),
    ),
    magic: Object.fromEntries(
      budgetRarities.map((r) => [
        r,
        toNumber(
          multiply(
            subtract(magicTargetAtXp(after, r, rules), magicTargetAtXp(start, r, rules)),
            rational(BigInt(partySize)),
          ),
        ),
      ]),
    ) as Record<BudgetRarity, number>,
  };
}

export function cumulativeGoldCopper(xp: number, rules: RewardGuidanceRules): string {
  if (!Number.isSafeInteger(xp) || xp < 0)
    throw new Error('Kumulierte XP benötigen eine nichtnegative ganze Zahl.');
  return String(roundHalfUp(goldTargetAtXp(xp, rules)));
}

export function cumulativeMagicGuidance(xps: number[], rules: RewardGuidanceRules) {
  if (xps.some((xp) => !Number.isSafeInteger(xp) || xp < 0))
    throw new Error('Magiebeute benötigt bestätigte nichtnegative XP.');
  const totals = budgetRarities.map(
    (r) => [r, xps.reduce((n, xp) => add(n, magicTargetAtXp(xp, r, rules)), rational(0n))] as const,
  );
  return {
    expected: Object.fromEntries(totals.map(([r, n]) => [r, toNumber(n)])) as Record<
      BudgetRarity,
      number
    >,
    quota: Object.fromEntries(totals.map(([r, n]) => [r, Number(roundHalfUp(n))])) as Record<
      BudgetRarity,
      number
    >,
  };
}
