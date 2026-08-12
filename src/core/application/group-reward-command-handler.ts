import {
  generateGroupDraftLootInputSchema,
  generateGroupDraftLootResultSchema
} from '../../shared/contracts/loot.js'
import type { CampaignRules } from '../../shared/contracts/campaign-rules.js'
import type { PartySnapshot } from '../../shared/contracts/party.js'
import type { SceneSnapshot } from '../../shared/contracts/scene.js'
import type {
  GroupRewardGeneratedRun,
  GroupRewardGenerationInput
} from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { evaluateSceneGroupDraft } from '../scene/group-generator.js'
import { normalizeGroupRewardEntries } from '../session-generation/group-reward-source.js'

export type GroupRewardGenerationPort = Readonly<{
  generateGroupReward(
    input: GroupRewardGenerationInput
  ): GroupRewardGeneratedRun
}>

export type GroupRewardCommandContext = Readonly<{
  party: Readonly<{ read(): PartySnapshot }>
  scenes: Readonly<{
    revision(): number
    snapshot(party: PartySnapshot['members']): SceneSnapshot
  }>
  rules: Readonly<{ read(): CampaignRules }>
  generation: GroupRewardGenerationPort
}>

export class GroupRewardCommandHandler {
  constructor(private readonly context: () => GroupRewardCommandContext) {}

  generate(raw: unknown): { run: GroupRewardGeneratedRun } {
    const input = generateGroupDraftLootInputSchema.parse(raw)
    const context = this.context()
    const party = context.party.read()
    if (party.revision !== input.expectedPartyRevision)
      throw new CapabilityError('stale', true)
    if (context.scenes.revision() !== input.expectedSceneRevision)
      throw new CapabilityError('stale', true)
    const scene = context.scenes
      .snapshot(party.members)
      .scenes.find((candidate) => candidate.id === input.sceneId)
    if (!scene) throw new CapabilityError('not_found', false)
    const group = scene.groups.find(
      (candidate) => candidate.id === input.groupId
    )
    if (input.expectedGroupRevision === null) {
      if (group) throw new CapabilityError('stale', true)
    } else {
      if (!group) throw new CapabilityError('not_found', false)
      if (group.archived) throw new CapabilityError('validation_failed', false)
      if (group.revision !== input.expectedGroupRevision)
        throw new CapabilityError('stale', true)
    }
    const rules = context.rules.read()
    if (rules.revision !== input.expectedCampaignRulesRevision)
      throw new CapabilityError('stale', true)
    const assigned = party.members.filter(
      (member) => member.active && scene.partyMemberIds.includes(member.id)
    )
    if (
      assigned.length === 0 ||
      assigned.some((member) => member.level === null)
    )
      throw new CapabilityError('validation_failed', false)
    const groupEntries = normalizeGroupRewardEntries(input.entries)
    const evaluation = evaluateSceneGroupDraft(scene.id, assigned, groupEntries)
    if (!evaluation.canStart)
      throw new CapabilityError('validation_failed', false)
    const counts = new Map<number, number>()
    for (const member of assigned)
      counts.set(member.level!, (counts.get(member.level!) ?? 0) + 1)
    const rewardXp =
      rules.rewardXpBasis === 'adjusted'
        ? evaluation.adjustedXp
        : evaluation.baseXp
    const run = context.generation.generateGroupReward({
      party: [...counts.entries()]
        .toSorted(([left], [right]) => left - right)
        .map(([level, count]) => ({ level, count })),
      sceneId: scene.id,
      groupId: input.groupId,
      sceneRevision: input.expectedSceneRevision,
      groupRevision: input.expectedGroupRevision,
      groupEntries,
      partyRevision: party.revision,
      campaignRulesRevision: rules.revision,
      rewardXpBasis: rules.rewardXpBasis,
      baseXp: evaluation.baseXp,
      adjustedXp: evaluation.adjustedXp,
      rewardXp,
      seed: input.seed
    })
    return generateGroupDraftLootResultSchema.parse({ run })
  }
}
