import {
  commitGroupRewardInputSchema,
  commitGroupRewardResultSchema,
  type CommitGroupRewardInput,
  type CommitGroupRewardResult,
  type Treasure,
  type TreasureAnchor
} from '../../shared/contracts/loot.js'
import type {
  SceneGroupCommandResult,
  PartySnapshot
} from '../../shared/contracts/live-session.js'
import type { CampaignRules } from '../../shared/contracts/campaign-rules.js'
import type { SceneGroup, SceneSnapshot } from '../../shared/contracts/scene.js'
import type {
  GeneratedRun,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'
import { fingerprintExcluding } from '../fingerprint.js'
import {
  normalizeGroupRewardEntries,
  sameGroupRewardEntries
} from '../session-generation/group-reward-source.js'
import type { LootCatalogIndex } from '../loot/loot-catalog-index.js'
import type { MaterializedGroupRewardTreasureDraft } from '../loot/group-reward-treasure-draft.js'
import { GroupRewardRevisionGuard } from './group-reward-revision-guard.js'
import { GroupRewardDraftMaterializer } from './group-reward-draft-materializer.js'

type GroupSaveInput = Readonly<{
  sceneId: string
  groupId: string | null
  prospectiveGroupId?: string
  name: string
  note: string
  disposition: SceneGroup['disposition']
  entries: readonly {
    creatureId: string
    quantity: number
    deadQuantity: number
  }[]
  expectedSceneRevision: number
  expectedGroupRevision: number | null
}>

export type GroupRewardCommitContext = Readonly<{
  party: Readonly<{ read(): PartySnapshot }>
  scenes: Readonly<{
    revision(): number
    snapshot(party: PartySnapshot['members']): SceneSnapshot
  }>
  rules: Readonly<{ read(): CampaignRules }>
  catalog: Readonly<{
    index(reference: {
      catalogVersion: string
      catalogContentHash: string
    }): LootCatalogIndex
  }>
  generatedRuns: Readonly<{ read(runId: string): GeneratedRun | null }>
  treasures: Readonly<{
    findByGenerated(runId: string, generatedTreasureId: string): Treasure | null
    acceptGeneratedDraft(
      run: GeneratedRun,
      generated: GeneratedTreasure,
      draft: MaterializedGroupRewardTreasureDraft,
      anchor: TreasureAnchor,
      now: string
    ): Treasure
  }>
  groupCommands: Readonly<{
    save(input: GroupSaveInput): SceneGroupCommandResult
    result(
      sceneId: string,
      groupIds: readonly string[]
    ): SceneGroupCommandResult
  }>
  journal: Readonly<{
    read(input: {
      commandId: string
      operationType: 'commit_group_reward'
      requestFingerprint: string
      targetId?: string
      schema: typeof commitGroupRewardResultSchema
    }): Readonly<{
      targetId: string
      result: CommitGroupRewardResult
    }> | null
    record(input: {
      commandId: string
      operationType: 'commit_group_reward'
      requestFingerprint: string
      targetId: string
      schema: typeof commitGroupRewardResultSchema
      result: CommitGroupRewardResult
    }): void
  }>
  projections: Readonly<{ bumpRevision(): void }>
  now(): string
}>

export class GroupRewardCommitHandler {
  constructor(
    private readonly context: () => GroupRewardCommitContext,
    private readonly transact: <T>(work: () => T) => T
  ) {}

  commit(raw: CommitGroupRewardInput): CommitGroupRewardResult {
    const input = commitGroupRewardInputSchema.parse(raw)
    return this.transact(() => {
      const context = this.context()
      const requestFingerprint = fingerprintExcluding(input, ['commandId'])
      const receipt = context.journal.read({
        commandId: input.commandId,
        operationType: 'commit_group_reward',
        requestFingerprint,
        targetId: input.groupId,
        schema: commitGroupRewardResultSchema
      })
      if (receipt) return receipt.result

      const { run, generated, existingGroup } = new GroupRewardRevisionGuard(
        context
      ).validate(input)
      const treasureDraft = new GroupRewardDraftMaterializer(
        context
      ).materialize(run, generated, input.treasureDraft)

      const changed =
        !existingGroup || !samePersistedGroup(existingGroup, input)
      const groupResult = changed
        ? context.groupCommands.save({
            sceneId: input.sceneId,
            groupId: existingGroup ? input.groupId : null,
            ...(!existingGroup && { prospectiveGroupId: input.groupId }),
            name: input.name,
            note: input.note,
            disposition: input.disposition,
            entries: normalizeGroupRewardEntries(input.entries),
            expectedSceneRevision: input.expectedSceneRevision,
            expectedGroupRevision: input.expectedGroupRevision
          })
        : context.groupCommands.result(input.sceneId, [input.groupId])
      const savedGroup = groupResult.scenePatch.upsertedGroups.find(
        (candidate) => candidate.id === input.groupId
      )
      if (!savedGroup) throw new Error('Committed group is missing from result')
      const treasure = context.treasures.acceptGeneratedDraft(
        run,
        generated,
        treasureDraft,
        {
          kind: 'group',
          sceneId: input.sceneId,
          groupId: input.groupId,
          lastKnownLabel: savedGroup.name
        },
        context.now()
      )
      context.projections.bumpRevision()
      const result = commitGroupRewardResultSchema.parse({
        groupResult,
        treasure
      })
      context.journal.record({
        commandId: input.commandId,
        operationType: 'commit_group_reward',
        requestFingerprint,
        targetId: input.groupId,
        schema: commitGroupRewardResultSchema,
        result
      })
      return result
    })
  }
}

function samePersistedGroup(
  group: SceneGroup,
  input: CommitGroupRewardInput
): boolean {
  return (
    group.name === input.name.trim() &&
    group.note === input.note.trim() &&
    group.disposition === input.disposition &&
    sameGroupRewardEntries(
      group.entries.map((entry) => ({
        creatureId: entry.creatureId,
        quantity: entry.aliveQuantity,
        deadQuantity: entry.deadQuantity
      })),
      input.entries
    )
  )
}
