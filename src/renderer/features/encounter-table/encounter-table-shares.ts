export type EncounterTableShare = Readonly<{
  creatureId: string
  percent: number
  exactPercent: number
}>

export function allocateEncounterTableShares(
  entries: readonly Readonly<{
    creatureId: string
    weight: number
  }>[]
): readonly EncounterTableShare[] {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return []
  const rows = entries.map((entry, index) => {
    const exactPercent = (entry.weight * 100) / total
    const percent = Math.floor(exactPercent)
    return {
      ...entry,
      index,
      exactPercent,
      percent,
      remainder: exactPercent - percent
    }
  })
  let remaining = 100 - rows.reduce((sum, row) => sum + row.percent, 0)
  for (const row of rows.toSorted(
    (left, right) =>
      right.remainder - left.remainder ||
      compareIdentity(left.creatureId, right.creatureId) ||
      left.index - right.index
  )) {
    if (remaining <= 0) break
    row.percent += 1
    remaining -= 1
  }
  return rows.map(({ creatureId, percent, exactPercent }) => ({
    creatureId,
    percent,
    exactPercent
  }))
}

function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
