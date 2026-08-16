import type {
  CommitGroupRewardInput,
  Treasure
} from '../../shared/contracts/loot.js'
import type { PartySnapshot } from '../../shared/contracts/live-session.js'
import type { CampaignRules } from '../../shared/contracts/campaign-rules.js'
import type { SceneGroup, SceneSnapshot } from '../../shared/contracts/scene.js'
import type {
  GeneratedRun,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { sameGroupRewardEntries } from '../session-generation/group-reward-source.js'
import type { CharacterRewardBalance } from '../loot/character-loot-store.js'

export type GroupRewardRevisionContext = Readonly<{
  party: Readonly<{ read(): PartySnapshot }>
  scenes: Readonly<{
    revision(): number
    snapshot(party: PartySnapshot['members']): SceneSnapshot
  }>
  rules: Readonly<{ read(): CampaignRules }>
  generatedRuns: Readonly<{ read(runId: string): GeneratedRun | null }>
  characterLoot?: Readonly<{
    rewardBalances(
      characterIds: readonly string[]
    ): readonly CharacterRewardBalance[]
  }>
  treasures: Readonly<{
    findByGenerated(runId: string, generatedTreasureId: string): Treasure | null
  }>
}>

export type GuardedGroupRewardCommit = Readonly<{
  run: Extract<GeneratedRun, { runKind: 'group_reward' }>
  generated: GeneratedTreasure
  existingGroup: SceneGroup | undefined
}>

export class GroupRewardRevisionGuard {
  constructor(private readonly context: GroupRewardRevisionContext) {}

  validate(input: CommitGroupRewardInput): GuardedGroupRewardCommit {
    const run = this.context.generatedRuns.read(input.runId)
    if (!run || run.runKind !== 'group_reward') notFound()
    const generated = run.treasures.find(
      (candidate) => candidate.id === input.generatedTreasureId
    )
    if (!generated) notFound()
    requireMatchingSource(run, input)

    const party = this.context.party.read()
    if (party.revision !== run.input.partyRevision) stale()
    const rules = this.context.rules.read()
    if (rules.revision !== run.input.campaignRulesRevision) stale()
    if (run.rewardBasis && this.context.characterLoot) {
      const revisions = new Map(
        this.context.characterLoot
          .rewardBalances(
            run.rewardBasis.members.map((member) => member.characterId)
          )
          .map((balance) => [balance.characterId, balance.ledgerRevision])
      )
      if (
        run.rewardBasis.members.some(
          (member) =>
            revisions.get(member.characterId) !== member.ledgerRevision
        )
      )
        stale()
    }
    if (this.context.scenes.revision() !== input.expectedSceneRevision) stale()
    const scene = this.context.scenes
      .snapshot(party.members)
      .scenes.find((candidate) => candidate.id === input.sceneId)
    if (!scene) notFound()
    const existingGroup = scene.groups.find(
      (candidate) => candidate.id === input.groupId
    )
    if (input.expectedGroupRevision === null) {
      if (existingGroup) stale()
    } else {
      if (!existingGroup) notFound()
      if (existingGroup.archived) invalid()
      if (existingGroup.revision !== input.expectedGroupRevision) stale()
    }
    if (
      this.context.treasures.findByGenerated(run.id, input.generatedTreasureId)
    )
      throw new CapabilityError('idempotency_conflict', false)
    return { run, generated, existingGroup }
  }
}

function requireMatchingSource(
  run: Extract<GeneratedRun, { runKind: 'group_reward' }>,
  input: CommitGroupRewardInput
): void {
  if (
    run.input.sceneId !== input.sceneId ||
    run.input.groupId !== input.groupId ||
    run.input.sceneRevision !== input.expectedSceneRevision ||
    run.input.groupRevision !== input.expectedGroupRevision ||
    !sameGroupRewardEntries(run.input.groupEntries, input.entries)
  )
    invalid()
}

function stale(): never {
  throw new CapabilityError('stale', true)
}

function invalid(): never {
  throw new CapabilityError('validation_failed', false)
}

function notFound(): never {
  throw new CapabilityError('not_found', false)
}
