import type { GroupRewardGenerationInput } from '../../shared/contracts/session-generation.js'
import { compareText } from './deterministic-order.js'

export type GroupRewardSourceEntryDraft = Readonly<{
  creatureId: string
  quantity: number
  deadQuantity: number
}>

export function normalizeGroupRewardEntries(
  entries: readonly GroupRewardSourceEntryDraft[]
): GroupRewardGenerationInput['groupEntries'] {
  const counts = new Map<string, { quantity: number; deadQuantity: number }>()
  for (const entry of entries) {
    const current = counts.get(entry.creatureId) ?? {
      quantity: 0,
      deadQuantity: 0
    }
    counts.set(entry.creatureId, {
      quantity: current.quantity + entry.quantity,
      deadQuantity: current.deadQuantity + entry.deadQuantity
    })
  }
  return [...counts]
    .map(([creatureId, value]) => ({ creatureId, ...value }))
    .filter((entry) => entry.quantity + entry.deadQuantity > 0)
    .toSorted((left, right) => compareText(left.creatureId, right.creatureId))
}

export function sameGroupRewardEntries(
  left: readonly GroupRewardSourceEntryDraft[],
  right: readonly GroupRewardSourceEntryDraft[]
): boolean {
  return (
    JSON.stringify(normalizeGroupRewardEntries(left)) ===
    JSON.stringify(normalizeGroupRewardEntries(right))
  )
}
