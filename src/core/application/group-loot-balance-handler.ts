import {
  evaluateGroupLootInputSchema,
  groupLootBalanceSchema,
  type EvaluateGroupLootInput,
  type GroupLootBalance,
  type ItemDefinition,
  itemDefinitionLineValueCp
} from '../../shared/contracts/loot.js'
import {
  lootRarityKeys,
  type GeneratorLootRules
} from '../../shared/contracts/generator-loot-rules.js'
import type { CampaignRules } from '../../shared/contracts/campaign-rules.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { GroupEditorContext } from './group-editor-handler.js'
import { validateEditorTreasure } from './group-editor-handler.js'
import type { CharacterLootStore } from '../loot/character-loot-store.js'
import type { LootProjectionStore } from '../loot/loot-projection-store.js'
import { evaluateSceneGroupDraft } from '../scene/group-generator.js'
import { calculateLedgerRewardBudget } from '../session-generation/reward-budget-stage.js'
import { createRewardRandom } from '../session-generation/reward-random.js'
import type { EncounterEntropy } from '../session-generation/deterministic-order.js'

export type GroupLootBalanceContext = Pick<
  GroupEditorContext,
  | 'party'
  | 'scenes'
  | 'treasures'
  | 'definitions'
  | 'generatedRuns'
  | 'containerExists'
> & {
  projections: Pick<LootProjectionStore, 'scene'>
  characterLoot: Pick<CharacterLootStore, 'rewardBalances'>
  rules: CampaignRules
  lootRules: GeneratorLootRules
}
export class GroupLootBalanceHandler {
  constructor(
    private readonly context: () => GroupLootBalanceContext,
    private readonly entropy: EncounterEntropy
  ) {}
  evaluate(raw: EvaluateGroupLootInput): GroupLootBalance {
    const input = evaluateGroupLootInputSchema.parse(raw),
      c = this.context(),
      party = c.party.read()
    const scene = c.scenes
      .snapshot(party.members)
      .scenes.find((s) => s.id === input.sceneId)
    if (!scene) throw new CapabilityError('not_found', false)
    if (c.scenes.revision() !== input.expectedRevision)
      throw new CapabilityError('stale', true)
    const groupId = input.groupId ?? input.prospectiveGroupId
    const group = scene.groups.find((g) => g.id === groupId)
    if ((group?.revision ?? null) !== input.expectedGroupRevision)
      throw new CapabilityError('stale', true)
    const currentMagic = Object.fromEntries(
      lootRarityKeys.map((r) => [r, 0])
    ) as GroupLootBalance['currentMagic']
    let currentValueCp = 0,
      currentCoinsCp = 0,
      currentItemsCp = 0
    const add = (definition: ItemDefinition, quantity: number) => {
      if (definition.magic && definition.rarity)
        currentMagic[definition.rarity] += quantity
      else {
        const value = itemDefinitionLineValueCp(definition, quantity)
        currentValueCp += value
        if (definition.components.coinDenominations.length)
          currentCoinsCp += value
        else currentItemsCp += value
      }
    }
    const persisted = c.projections
      .scene(scene.id, scene.locationId, [groupId])
      .groupTreasures.flatMap((g) => g.treasures)
    const replaced = new Set(
      input.treasures.flatMap((t) => (t.treasureId ? [t.treasureId] : []))
    )
    for (const treasure of persisted)
      if (!replaced.has(treasure.id))
        for (const item of treasure.items)
          add(item.definition, item.quantity - item.allocatedQuantity)
    for (const draft of input.treasures) {
      const existing = validateEditorTreasure(c, draft, scene.id, groupId)
      for (const item of draft.items)
        add(
          c.definitions.resolve(item.itemReference),
          item.quantity -
            (existing?.items.find((i) => i.id === item.id)?.allocatedQuantity ??
              0)
        )
    }
    const assigned = party.members.filter(
      (m) => m.active && scene.partyMemberIds.includes(m.id)
    )
    const result: GroupLootBalance = {
      status: 'ready',
      currentValueCp,
      currentCoinsCp,
      currentItemsCp,
      currentMagic,
      targetValueCp: null,
      differenceCp: null,
      targetMagic: null,
      tolerance: c.lootRules.audit.normalBudgetTolerance,
      band: null,
      rewardXp: null,
      rewardXpBasis: c.rules.rewardXpBasis,
      partyRevision: party.revision,
      rulesRevision: c.rules.revision
    }
    if (!assigned.length) result.status = 'missing_party'
    else if (assigned.some((m) => m.level === null))
      result.status = 'missing_level'
    else if (!input.entries.some((e) => e.quantity > 0))
      result.status = 'empty_roster'
    else {
      const evaluation = evaluateSceneGroupDraft(
        scene.id,
        assigned,
        input.entries
      )
      if (!evaluation.canStart) result.status = 'unavailable_creature'
      else {
        const rewardXp =
          c.rules.rewardXpBasis === 'base'
            ? evaluation.baseXp
            : evaluation.adjustedXp
        const balances = c.characterLoot.rewardBalances(
          assigned.map((m) => m.id)
        )
        const budget = calculateLedgerRewardBudget(
          {
            members: assigned.map((m) => {
              const b = balances.find((b) => b.characterId === m.id)
              if (!b) throw new Error('Missing character reward balance')
              return {
                characterId: m.id,
                level: m.level!,
                currentXp: m.xp,
                ledgerRevision: b.ledgerRevision,
                currentNonMagicCp: b.currentNonMagicCp,
                currentMagic: b.currentMagic
              }
            }),
            rewardXp,
            rules: c.lootRules,
            profile: 'group_reward'
          },
          createRewardRandom(input.budgetSeed, this.entropy)
        )
        result.targetValueCp = budget.goldBudgetCp.value
        result.targetMagic = budget.magicTargets
        result.rewardXp = rewardXp
        result.differenceCp = currentValueCp - result.targetValueCp
        result.band =
          Math.abs(result.differenceCp) <=
          result.targetValueCp * result.tolerance
            ? 'within'
            : result.differenceCp < 0
              ? 'below'
              : 'above'
      }
    }
    return groupLootBalanceSchema.parse(result)
  }
}
