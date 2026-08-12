import type { EncounterEntropy } from './deterministic-order.js'
import { slotRoleStream, treasurePlanningStream } from './entropy-streams.js'
import { decimal, multiply, rational, roundHalfUp } from './rational.js'
import {
  freezeStage,
  lootRoles,
  type LootRole,
  type RewardTreasurePlan,
  type RolePlannedTreasure
} from './reward-stage-types.js'

const roleShares = [0.25, 0.25, 0.3, 0.2] as const

export type SlotRolePlanningInput = Readonly<{
  profile: 'session' | 'group_reward'
  seed: number
  adventureDayFraction?: string
  treasures: readonly RewardTreasurePlan[]
}>

/**
 * Preconditions: at least one Treasure plan exists. Postconditions: every
 * Treasure has at least one slot and one role per slot; global role balancing
 * is deterministic and the plans are immutable.
 */
export function planSlotsAndRoles(
  input: SlotRolePlanningInput,
  entropy: EncounterEntropy
): readonly RolePlannedTreasure[] {
  if (input.treasures.length === 0) throw new Error('missing_treasure_plan')
  const totalSlots =
    input.profile === 'group_reward'
      ? 3 +
        entropy.modulo(
          treasurePlanningStream(input.seed, 'group-loot-slots', 0),
          3
        )
      : sessionSlotCount(input, entropy)
  const slots = descendingSlots(totalSlots, input.treasures.length)
  const counts = new Map<LootRole, number>()
  return freezeStage(
    input.treasures.map((treasure, treasureIndex) => ({
      ...treasure,
      roles: Array.from({ length: slots[treasureIndex] ?? 1 }, (_, slot) => {
        const role = chooseRole(input.seed, treasure.id, slot, counts, entropy)
        counts.set(role, (counts.get(role) ?? 0) + 1)
        return role
      })
    }))
  )
}

function sessionSlotCount(
  input: SlotRolePlanningInput,
  entropy: EncounterEntropy
): number {
  const fraction = decimal(input.adventureDayFraction ?? '1')
  const fullDaySlots =
    6 + entropy.modulo(treasurePlanningStream(input.seed, 'loot-slots', 0), 5)
  return Math.max(
    input.treasures.length,
    roundHalfUp(multiply(rational(BigInt(fullDaySlots)), fraction))
  )
}

function descendingSlots(total: number, count: number): number[] {
  const slots = Array.from({ length: count }, () => 1)
  let remaining = Math.max(0, total - slots.length)
  let index = 0
  while (remaining > 0) {
    slots[index % slots.length]! += 1
    index += 1
    remaining -= 1
  }
  return slots
}

function chooseRole(
  seed: number,
  treasureId: string,
  slot: number,
  counts: ReadonlyMap<LootRole, number>,
  entropy: EncounterEntropy
): LootRole {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  const weights = lootRoles.map((role, index) => {
    const actual = total === 0 ? 0 : (counts.get(role) ?? 0) / total
    return Math.max(
      0.01,
      roleShares[index]! + (roleShares[index]! - actual) * 1.5
    )
  })
  let cursor =
    entropy.unit(slotRoleStream(seed, treasureId, slot)) *
    weights.reduce((sum, weight) => sum + weight, 0)
  for (let index = 0; index < lootRoles.length; index += 1) {
    cursor -= weights[index]!
    if (cursor <= 0) return lootRoles[index]!
  }
  return lootRoles.at(-1)!
}
