import type { EncounterCatalog, ProgressionRow } from './catalog.js'
import {
  add,
  decimal,
  divide,
  multiply,
  rational,
  roundHalfUp,
  toNumber,
  type Rational
} from './rational.js'
import type { SessionGenerationEncounterInput } from '../../shared/contracts/session-generation.js'

export type SessionContext = Readonly<{
  partyCount: number
  dayXpBudget: number
  sessionXpTarget: number
  averageLevel: number
  encounterCount: number
  fraction: Rational
}>

export function calculateSessionContext(
  input: SessionGenerationEncounterInput,
  catalog: EncounterCatalog
): SessionContext {
  const fraction = decimal(input.adventureDayFraction)
  const activeParty = input.party.filter((entry) => entry.count > 0)
  const partyCount = activeParty.reduce((sum, entry) => sum + entry.count, 0)
  const progression = new Map(
    catalog.progression.map((row) => [row.level, row])
  )
  const dayXpBudget = activeParty.reduce(
    (sum, entry) =>
      sum +
      requiredProgression(progression, entry.level).dayXpPerCharacter *
        entry.count,
    0
  )
  const sessionXpTarget = roundHalfUp(
    multiply(rational(BigInt(dayXpBudget)), fraction)
  )
  const averageLevel = interpolatedLevel(dayXpBudget, catalog)
  const encounterCount =
    input.encounterCount ?? automaticEncounterCount(input.seed, fraction)
  return {
    partyCount,
    dayXpBudget,
    sessionXpTarget,
    averageLevel,
    encounterCount,
    fraction
  }
}

export function automaticEncounterCount(
  seed: number,
  fraction: Rational
): number {
  const fullDay =
    6 + (Math.floor(Math.abs(Math.sin((seed + 409) * 12.9898)) * 1_000_000) % 3)
  return clamp(
    roundHalfUp(multiply(rational(BigInt(fullDay)), fraction)),
    1,
    10
  )
}

export function encounterTargets(
  input: SessionGenerationEncounterInput,
  count: number,
  sessionXp: number,
  catalog: EncounterCatalog
): readonly number[] {
  if (count === 1) return [sessionXp]
  const progression = new Map(
    catalog.progression.map((row) => [row.level, row])
  )
  const threshold = (
    key: 'mediumXpPerCharacter' | 'hardXpPerCharacter' | 'deadlyXpPerCharacter'
  ): Rational =>
    input.party.reduce(
      (sum, entry) =>
        add(
          sum,
          rational(
            BigInt(
              requiredProgression(progression, entry.level)[key] * entry.count
            )
          )
        ),
      rational(0n)
    )
  const medium = threshold('mediumXpPerCharacter')
  const hard = threshold('hardXpPerCharacter')
  const deadly = threshold('deadlyXpPerCharacter')
  const raw = Array.from({ length: count }, (_, index) => {
    if (index === 0) return multiply(medium, rational(17n, 20n))
    if (index === count - 1) return deadly
    return add(
      medium,
      multiply(
        add(hard, multiply(medium, rational(-1n))),
        rational(BigInt(index), BigInt(count - 1))
      )
    )
  })
  const total = raw.reduce((sum, value) => add(sum, value), rational(0n))
  const session = rational(BigInt(sessionXp))
  const result: number[] = []
  let assigned = 0
  for (let index = 0; index < count; index += 1) {
    const target =
      index === count - 1
        ? sessionXp - assigned
        : roundHalfUp(divide(multiply(raw[index]!, session), total))
    result.push(target)
    assigned += target
  }
  return result
}

export function interpolatedLevel(
  dayXp: number,
  catalog: EncounterCatalog
): number {
  const rows = [...catalog.progression].sort(
    (left, right) =>
      left.dayXpParty4 - right.dayXpParty4 || left.level - right.level
  )
  if (dayXp <= rows[0]!.dayXpParty4) return rows[0]!.level
  for (let index = 0; index < rows.length - 1; index += 1) {
    const lower = rows[index]!
    const upper = rows[index + 1]!
    if (dayXp <= upper.dayXpParty4) {
      const ratio = divide(
        rational(BigInt(dayXp - lower.dayXpParty4)),
        rational(BigInt(Math.max(1, upper.dayXpParty4 - lower.dayXpParty4)))
      )
      return toNumber(
        add(
          rational(BigInt(lower.level)),
          multiply(rational(BigInt(upper.level - lower.level)), ratio)
        )
      )
    }
  }
  return rows.at(-1)!.level
}

export function requiredProgression(
  progression: ReadonlyMap<number, ProgressionRow>,
  level: number
): ProgressionRow {
  const row = progression.get(level)
  if (row === undefined)
    throw new Error('catalog_reference_missing:progression_level')
  return row
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
