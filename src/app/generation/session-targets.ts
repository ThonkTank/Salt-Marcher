import { encounterThresholds, type EncounterParty } from '../encounter-contracts';
import { dailyXp } from '../progression';
import { exactWeight } from '../generation-contracts';
import { add, decimal, multiply, rational, roundHalfUp } from './rational';

export interface SessionTargets {
  version: 'saltmarcher-targets-v1';
  seed: string;
  seedNumber: number;
  party: { level: number; count: number }[];
  fraction: string;
  requestedCount: number | null;
  dayBudget: number;
  budget: number;
  encounterTargets: number[];
  audit: {
    code: 'encounter_target_sum';
    hard: true;
    passed: true;
    actual: number;
    expected: number;
  };
}
/** Numeric seeds retain the original policy; named seeds have one stable numeric mapping. */
function numericSeed(seed: string) {
  if (/^\d+$/.test(seed) && Number.isSafeInteger(Number(seed))) return Number(seed);
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
/** Adapted from SaltMarcher's pinned encounter-target-policy: exact rational allocation. */
export function sessionTargets(
  party: Pick<EncounterParty, 'level' | 'count'>[],
  fractionText: string,
  seed: string,
  requestedCount?: number | null,
): SessionTargets {
  if (
    typeof seed !== 'string' ||
    !seed.trim() ||
    seed.length > 1000 ||
    !Array.isArray(party) ||
    !party.length
  )
    throw new Error('Planungsparty und Seed fehlen.');
  const counts = new Map<number, number>();
  for (const row of party) {
    if (
      !row ||
      !Number.isSafeInteger(row.level) ||
      row.level! < 1 ||
      row.level! > 20 ||
      !Number.isSafeInteger(row.count) ||
      row.count < 0
    )
      throw new Error('Für die Generierung sind Level 1–20 und gültige Anzahlen erforderlich.');
    if (row.count) counts.set(row.level!, (counts.get(row.level!) ?? 0) + row.count);
  }
  const normalized = [...counts]
    .sort(([a], [b]) => a - b)
    .map(([level, count]) => ({ level, count }));
  if (!normalized.length) throw new Error('Die Planungsparty benötigt mindestens eine Figur.');
  const fraction = exactWeight(fractionText),
    ratio = decimal(fraction),
    dayBudget = normalized.reduce((n, p) => n + dailyXp[p.level - 1]! * p.count, 0);
  if (!Number.isSafeInteger(dayBudget)) throw new Error('Tagesbudget ist zu groß.');
  const budget = roundHalfUp(multiply(rational(BigInt(dayBudget)), ratio)),
    seedNumber = numericSeed(seed);
  if (!Number.isSafeInteger(dayBudget) || !Number.isSafeInteger(budget) || budget < 0)
    throw new Error('Tagesbudget ist zu groß.');
  if (
    requestedCount != null &&
    (!Number.isSafeInteger(requestedCount) || requestedCount < 1 || requestedCount > 10)
  )
    throw new Error('Begegnungszahl: leer für Automatik oder 1–10 angeben.');
  const fullDay =
      6 + (Math.floor(Math.abs(Math.sin((seedNumber + 409) * 12.9898)) * 1_000_000) % 3),
    count =
      requestedCount ??
      Math.max(1, Math.min(10, roundHalfUp(multiply(rational(BigInt(fullDay)), ratio))));
  const threshold = (index: number) =>
      rational(
        BigInt(
          normalized.reduce((n, p) => n + encounterThresholds[p.level - 1]![index]! * p.count, 0),
        ),
      ),
    medium = threshold(1),
    hard = threshold(2),
    deadly = threshold(3);
  const weights = Array.from({ length: count }, (_, i) =>
    i === 0
      ? multiply(medium, rational(17n, 20n))
      : i === count - 1
        ? deadly
        : add(
            medium,
            multiply(
              add(hard, multiply(medium, rational(-1n))),
              rational(BigInt(i), BigInt(count - 1)),
            ),
          ),
  );
  const sum = weights.reduce(add, rational(0n));
  let assigned = 0;
  const encounterTargets = weights.map((w, i) => {
    const target =
      i === count - 1
        ? budget - assigned
        : roundHalfUp(multiply(w, rational(BigInt(budget) * sum.denominator, sum.numerator)));
    assigned += target;
    return target;
  });
  if (assigned !== budget || encounterTargets.some((n) => n < 0))
    throw new Error('Begegnungsziele können nicht aufgeteilt werden. Weniger Begegnungen wählen.');
  return {
    version: 'saltmarcher-targets-v1',
    seed,
    seedNumber,
    party: normalized,
    fraction,
    requestedCount: requestedCount ?? null,
    dayBudget,
    budget,
    encounterTargets,
    audit: {
      code: 'encounter_target_sum',
      hard: true,
      passed: true,
      actual: assigned,
      expected: budget,
    },
  };
}
