import type { GeneratedRunStore } from '../session-generation/generated-run-store.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  commitGroupEditorInputSchema,
  commitGroupEditorResultSchema,
  type CommitGroupEditorInput,
  type GroupEditorTreasure,
  type Treasure,
  itemReferenceKey
} from '../../shared/contracts/loot.js'
import { fingerprintExcluding } from '../fingerprint.js'
import type { GroupRewardCommitContext } from './group-reward-commit-handler.js'
import type { TreasureStore } from '../loot/loot-store.js'
import type { LootOperationJournal } from '../loot/loot-operation-journal.js'
import type { ItemDefinitionResolver } from '../loot/item-definition-resolver.js'

export type GroupEditorContext = Pick<
  GroupRewardCommitContext,
  'party' | 'scenes' | 'groupCommands' | 'projections' | 'now'
> & {
  treasures: Pick<
    TreasureStore,
    | 'require'
    | 'createManual'
    | 'update'
    | 'acceptGeneratedDraft'
    | 'findByGenerated'
  >
  containerExists: (catalogId: string) => boolean
  generatedRuns: Pick<GeneratedRunStore, 'read'>
  journal: LootOperationJournal
  definitions: Pick<ItemDefinitionResolver, 'resolve'>
}

export function validateEditorTreasure(
  context: Pick<
    GroupEditorContext,
    'treasures' | 'definitions' | 'generatedRuns' | 'containerExists'
  >,
  draft: GroupEditorTreasure,
  sceneId: string,
  groupId: string
): Treasure | null {
  const current = draft.treasureId
    ? context.treasures.require(draft.treasureId)
    : null
  if (
    current &&
    (current.anchor.kind !== 'group' ||
      current.anchor.sceneId !== sceneId ||
      current.anchor.groupId !== groupId)
  )
    throw new CapabilityError('validation_failed', false)
  if (current && current.revision !== draft.expectedRevision)
    throw new CapabilityError('stale', true)
  const ids = draft.items.flatMap((i) => (i.id ? [i.id] : []))
  const containers = draft.containers.map((c) => c.id)
  if (
    new Set(ids).size !== ids.length ||
    new Set(containers).size !== containers.length
  )
    throw new CapabilityError('validation_failed', false)
  for (const container of draft.containers) {
    const existing = current?.containers.find((c) => c.id === container.id)
    const originalCatalogId =
      existing && existing.provenance.kind !== 'manual'
        ? existing.provenance.catalogContainerId
        : null
    if (existing && originalCatalogId !== container.catalogContainerId)
      throw new CapabilityError('validation_failed', false)
    if (
      !existing &&
      container.catalogContainerId &&
      !context.containerExists(container.catalogContainerId)
    )
      throw new CapabilityError('validation_failed', false)
    if (!existing && container.sourceContainerId) {
      const run = draft.generation
        ? context.generatedRuns.read(draft.generation.runId)
        : null
      if (
        !run?.treasures.some((t) =>
          t.containers.some(
            (c) =>
              c.id === container.sourceContainerId &&
              c.catalogContainerId === container.catalogContainerId
          )
        )
      )
        throw new CapabilityError('validation_failed', false)
    }
  }
  for (const item of draft.items) {
    const existing = current?.items.find((i) => i.id === item.id)
    if (item.id && !existing)
      throw new CapabilityError('validation_failed', false)
    if (
      existing &&
      itemReferenceKey(existing.itemReference) !==
        itemReferenceKey(item.itemReference)
    )
      throw new CapabilityError('validation_failed', false)
    if (item.itemReference.kind === 'legacy' && !existing)
      throw new CapabilityError('validation_failed', false)
    if (
      !existing &&
      item.itemReference.kind === 'generated' &&
      !item.sourceLineId
    )
      throw new CapabilityError('validation_failed', false)
    if (
      existing &&
      item.sourceLineId !==
        (existing.provenance.kind === 'generator'
          ? existing.provenance.sourceLineId
          : null)
    )
      throw new CapabilityError('validation_failed', false)
    if (item.sourceLineId && !existing) {
      const ref = item.itemReference
      const run =
        ref.kind === 'generated' ? context.generatedRuns.read(ref.runId) : null
      if (
        !run?.treasures.some((t) =>
          t.items.some(
            (i) =>
              i.id === item.sourceLineId &&
              itemReferenceKey(i.itemReference) === itemReferenceKey(ref)
          )
        )
      )
        throw new CapabilityError('validation_failed', false)
    }
    const definition = context.definitions.resolve(item.itemReference)
    if (
      (!definition.stackable && item.quantity !== 1) ||
      (item.containerId && !containers.includes(item.containerId))
    )
      throw new CapabilityError('validation_failed', false)
    if (existing && item.quantity < existing.allocatedQuantity)
      throw new CapabilityError('validation_failed', false)
  }
  if (
    current?.items.some((i) => i.allocatedQuantity > 0 && !ids.includes(i.id))
  )
    throw new CapabilityError('validation_failed', false)
  return current
}

export class GroupEditorHandler {
  constructor(
    private readonly context: () => GroupEditorContext,
    private readonly transact: <T>(work: () => T) => T
  ) {}
  receipt(raw: CommitGroupEditorInput) {
    const input = commitGroupEditorInputSchema.parse(raw)
    return (
      this.context().journal.read({
        commandId: input.commandId,
        operationType: 'commit_group_editor',
        requestFingerprint: fingerprintExcluding(input, ['commandId']),
        targetId: input.groupId ?? input.prospectiveGroupId,
        schema: commitGroupEditorResultSchema
      })?.result ?? null
    )
  }
  commit(raw: CommitGroupEditorInput) {
    const input = commitGroupEditorInputSchema.parse(raw)
    return this.transact(() => {
      const receipt = this.receipt(input)
      if (receipt) return receipt
      const c = this.context(),
        groupId = input.groupId ?? input.prospectiveGroupId
      const scene = c.scenes
        .snapshot(c.party.read().members)
        .scenes.find((s) => s.id === input.sceneId)
      if (!scene) throw new CapabilityError('not_found', false)
      const existing = scene.groups.find((g) => g.id === groupId)
      if (existing?.archived)
        throw new CapabilityError('validation_failed', false)
      if ((existing?.revision ?? null) !== input.expectedGroupRevision)
        throw new CapabilityError('stale', true)
      for (const draft of input.treasures) {
        validateEditorTreasure(c, draft, input.sceneId, groupId)
        if (
          !draft.treasureId &&
          draft.generation &&
          c.treasures.findByGenerated(
            draft.generation.runId,
            draft.generation.treasureId
          )
        )
          throw new CapabilityError('stale', true)
      }
      const groupResult = c.groupCommands.save({
        sceneId: input.sceneId,
        groupId: input.groupId,
        prospectiveGroupId: input.prospectiveGroupId,
        name: input.name,
        note: input.note,
        disposition: input.disposition,
        entries: input.entries.map((e) => ({
          ...e,
          deadQuantity: e.deadQuantity ?? 0
        })),
        expectedSceneRevision: input.expectedRevision,
        expectedGroupRevision: input.expectedGroupRevision
      })
      const saved = groupResult.scenePatch.upsertedGroups.find(
        (g) => g.id === groupId
      )
      if (!saved) throw new Error('Saved group missing')
      const anchor = {
        kind: 'group' as const,
        sceneId: input.sceneId,
        groupId,
        lastKnownLabel: saved.name
      }
      const treasures = input.treasures.flatMap((draft) => {
        const payload = {
          commandId: input.commandId,
          label: draft.label,
          anchor,
          items: draft.items,
          containers: draft.containers
        }
        const treasure = draft.treasureId
          ? c.treasures.update(
              {
                ...payload,
                treasureId: draft.treasureId,
                expectedRevision: draft.expectedRevision!
              },
              c.now()
            )
          : draft.generation
            ? this.createGenerated(c, draft, anchor)
            : c.treasures.createManual(payload, c.now())
        return [{ key: draft.key, treasure }]
      })
      if (treasures.length) c.projections.bumpRevision()
      const result = commitGroupEditorResultSchema.parse({
        groupResult,
        treasures
      })
      c.journal.record({
        commandId: input.commandId,
        operationType: 'commit_group_editor',
        requestFingerprint: fingerprintExcluding(input, ['commandId']),
        targetId: groupId,
        schema: commitGroupEditorResultSchema,
        result
      })
      return result
    })
  }
  private createGenerated(
    c: GroupEditorContext,
    draft: GroupEditorTreasure,
    anchor: {
      kind: 'group'
      sceneId: string
      groupId: string
      lastKnownLabel: string
    }
  ) {
    const run = draft.generation
      ? c.generatedRuns.read(draft.generation.runId)
      : null
    const generated = run?.treasures.find(
      (t) => t.id === draft.generation?.treasureId
    )
    if (!run || !generated)
      throw new CapabilityError('validation_failed', false)
    if (
      run.runKind === 'group_reward' &&
      (run.input.sceneId !== anchor.sceneId ||
        run.input.groupId !== anchor.groupId)
    )
      throw new CapabilityError('validation_failed', false)
    return c.treasures.acceptGeneratedDraft(
      run,
      generated,
      {
        label: draft.label,
        items: draft.items.map((i, index) => ({
          draftId: String(index),
          sourceLineId: i.sourceLineId ?? null,
          itemReference: i.itemReference,
          quantity: i.quantity,
          containerDraftId: i.containerId
        })),
        containers: draft.containers.map((c) => ({
          draftId: c.id,
          sourceContainerId: c.sourceContainerId ?? null,
          catalogContainerId: c.catalogContainerId,
          name: c.name,
          capacity: c.capacity
        }))
      },
      anchor,
      c.now()
    )
  }
}
