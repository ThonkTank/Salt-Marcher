/** Shared D&D XP multiplier tables; party-size policy remains in math.ts. */
export function baseEncounterMultiplier(count: number): number {
  return count === 1
    ? 1
    : count === 2
      ? 1.5
      : count <= 6
        ? 2
        : count <= 10
          ? 2.5
          : count <= 14
            ? 3
            : 4
}

export function quantityMultiplier(quantity: number): number {
  return baseEncounterMultiplier(quantity)
}

export function effectiveEncounterMultiplier(effectiveCount: number): number {
  return baseEncounterMultiplier(effectiveCount)
}
