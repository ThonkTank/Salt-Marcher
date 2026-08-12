/** Canonical 2014 encounter multiplier used by planning and reward policy. */
export function encounterXpMultiplier(
  creatureCount: number,
  partySize: number
): number {
  const count = Math.max(0, Math.trunc(creatureCount))
  let value = baseMultiplier(count)
  if (partySize < 3) value = baseMultiplier(count) + (count > 14 ? 1 : 0.5)
  if (partySize > 5 && value > 1)
    value =
      [1, 1, 1.5, 2, 2.5, 3][[1, 1.5, 2, 2.5, 3, 4].indexOf(value)] ?? value
  return value
}

function baseMultiplier(count: number): number {
  return count <= 1
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
