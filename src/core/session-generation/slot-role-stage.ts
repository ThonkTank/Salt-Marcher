import type { EncounterEntropy } from './deterministic-order.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import { slotRoleStream, treasurePlanningStream } from './entropy-streams.js'
import { decimal, multiply, rational, roundHalfUp } from './rational.js'
import {
  freezeStage,
  lootRoles,
  type LootRole,
  type RewardTreasurePlan,
  type RolePlannedTreasure
} from './reward-stage-types.js'

export type SlotRolePlanningInput = Readonly<{
  profile: 'session' | 'group_reward'
  seed: number
  adventureDayFraction?: string
  treasures: readonly RewardTreasurePlan[]
  rules?: GeneratorLootRules
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
  const rules = input.rules ?? defaultGeneratorLootRules
  const totalSlots =
    input.profile === 'group_reward'
      ? Math.max(
          1,
          Math.round(
            rules.treasure.slotTarget * rules.treasure.encounterTreasureRatio
          )
        )
      : sessionSlotCount(input, entropy)
  const slots = descendingSlots(totalSlots, input.treasures.length)
  const counts = new Map<LootRole, number>()
  return freezeStage(
    input.treasures.map((treasure, treasureIndex) => ({
      ...treasure,
      roles: Array.from({ length: slots[treasureIndex] ?? 1 }, (_, slot) => {
        const role = chooseRole(
          input.seed,
          treasure.id,
          slot,
          counts,
          rules,
          entropy
        )
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
    (input.rules ?? defaultGeneratorLootRules).treasure.slotMin +
    entropy.modulo(
      treasurePlanningStream(input.seed, 'loot-slots', 0),
      (input.rules ?? defaultGeneratorLootRules).treasure.slotMax -
        (input.rules ?? defaultGeneratorLootRules).treasure.slotMin +
        1
    )
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
  rules: GeneratorLootRules,
  entropy: EncounterEntropy
): LootRole {
  const roleShares = [
    rules.mix.roles.compactValue,
    rules.mix.roles.complexValue,
    rules.mix.roles.useful,
    rules.mix.roles.flavor
  ] as const
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  const weights = lootRoles.map((role, index) => {
    const actual = total === 0 ? 0 : (counts.get(role) ?? 0) / total
    return Math.max(
      0.01,
      roleShares[index]! +
        (roleShares[index]! - actual) * rules.balance.roleStrength
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
