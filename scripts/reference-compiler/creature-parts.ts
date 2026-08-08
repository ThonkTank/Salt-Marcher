import type { CreatureAction } from '../../src/shared/contracts/creature.js'

export type SourceCreatureAction = Readonly<{ name: string; desc: string }>

export function compileCreatureActions(
  creatureId: string,
  partKind: 'trait' | 'action' | 'legendary-action',
  rows: readonly SourceCreatureAction[],
  overrides: Readonly<Record<string, string>>,
  usedOverrides: Set<string>
): CreatureAction[] {
  const totals = Map.groupBy(rows, (row) => slug(row.name))
  const seen = new Map<string, number>()
  const actions = rows.map((row): CreatureAction => {
    const baseId = slug(row.name)
    const occurrence = (seen.get(baseId) ?? 0) + 1
    seen.set(baseId, occurrence)
    const collision = (totals.get(baseId)?.length ?? 0) > 1
    const overrideKey = `${creatureId}:${partKind}:${baseId}:${occurrence}`
    const override = overrides[overrideKey]
    if (collision && override === undefined)
      throw new Error(
        `Creature part ID collision requires override: ${overrideKey}`
      )
    if (override !== undefined) usedOverrides.add(overrideKey)
    return { id: override ?? baseId, name: row.name, description: row.desc }
  })
  for (const [id, duplicates] of Map.groupBy(actions, (action) => action.id))
    if (duplicates.length > 1)
      throw new Error(
        `Creature part override collision: ${creatureId}:${partKind}:${id}`
      )
  return actions
}

function slug(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'part'
  )
}
