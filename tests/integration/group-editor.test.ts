import { evaluateSceneGroupDraft } from '../../src/core/scene/group-generator.js'
import {
  createGroupLootDraftHistory,
  groupLootDraftFromRun
} from '../../src/renderer/features/loot/group-loot-draft.js'
import { emptyEditorLoot } from '../../src/renderer/features/session/group-editor-loot.js'
import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { groupEditorContext } from '../helpers/group-editor-context.js'
import { GroupEditorHandler } from '../../src/core/application/group-editor-handler.js'
import {
  editorLootFromTreasure,
  editorLootPayload,
  preserveAllocatedEditorLoot
} from '../../src/renderer/features/session/group-editor-loot.js'

const contexts: ReturnType<typeof groupEditorContext>[] = []
function setup() {
  const context = groupEditorContext()
  contexts.push(context)
  return context
}
afterEach(() => {
  for (const context of contexts.splice(0)) context.close()
})
describe('atomic group editor', () => {
  it('saves a manual selection without party or generation and returns the original receipt', () => {
    const c = setup(),
      request = c.request(),
      result = c.editor.commit(request)
    expect(result.groupResult.scenePatch.upsertedGroups[0]).toMatchObject({
      name: 'Gruppe 1',
      note: 'Keep note',
      disposition: 'neutral'
    })
    expect(result.treasures[0]?.treasure.items[0]?.quantity).toBe(3)
    expect(result.treasures[0]?.treasure.source.kind).toBe('manual')
    expect(c.editor.commit(request)).toEqual(result)
    c.db.pragma('query_only = ON')
    expect(c.editor.receipt(request)).toEqual(result)
    c.db.pragma('query_only = OFF')
    expect(() => c.editor.commit({ ...request, name: 'Different' })).toThrow()
  })
  it('keeps generated definitions and lineage when monsters change and manual loot is mixed in', () => {
    const c = setup()
    c.assign()
    const request = c.request()
    const result = c.rewards.generate({
      sceneId: c.sceneId,
      groupId: request.prospectiveGroupId,
      expectedSceneRevision: c.scenes.revision(),
      expectedGroupRevision: null,
      expectedPartyRevision: c.party.read().revision,
      expectedCampaignRulesRevision: c.rules.read().revision,
      entries: request.entries,
      seed: 81337
    })
    if (result.status !== 'success')
      throw new Error('Expected generated reward')
    const run = result.run,
      draft = groupLootDraftFromRun(run)
    expect(draft.items.length).toBeGreaterThan(0)
    const loot = editorLootPayload('mixed', {
      ...emptyEditorLoot(),
      run,
      history: createGroupLootDraftHistory(draft)
    })!
    loot.items.push(request.treasures[0]!.items[0]!)
    request.entries = [{ creatureId: 'wolf', quantity: 6, deadQuantity: 1 }]
    request.treasures = [loot]
    const saved = c.editor.commit(request)
    expect(saved.treasures[0]?.treasure.source).toEqual({
      kind: 'generated',
      runId: run.id,
      generatedTreasureId: run.treasures[0]!.id
    })
    expect(saved.treasures[0]?.treasure.items[0]?.provenance.kind).toBe(
      'generator'
    )
    expect(c.context.generatedRuns.read(run.id)).toEqual(run)
    const group = saved.groupResult.scenePatch.upsertedGroups[0]!
    c.editor.commit({
      ...request,
      commandId: randomUUID(),
      groupId: group.id,
      expectedGroupRevision: group.revision,
      expectedRevision: c.scenes.revision(),
      entries: [{ creatureId: 'wolf', quantity: 1, deadQuantity: 1 }],
      treasures: []
    })
    expect(
      c.context.treasures.require(saved.treasures[0]!.treasure.id)
    ).toEqual(saved.treasures[0]!.treasure)
  })
  it('supports empty groups and reserves the next free optional name', () => {
    const c = setup(),
      a = c.editor.commit({ ...c.request(), entries: [], treasures: [] }),
      b = c.editor.commit({ ...c.request(), entries: [], treasures: [] })
    expect(a.groupResult.scenePatch.upsertedGroups[0]?.name).toBe('Gruppe 1')
    expect(b.groupResult.scenePatch.upsertedGroups[0]?.name).toBe('Gruppe 2')
  })
  it('acknowledges an explicitly named empty manual treasure', () => {
    const c = setup(),
      request = c.request()
    request.treasures[0]!.items = []
    const saved = c.editor.commit(request)
    expect(saved.treasures[0]?.treasure).toMatchObject({
      label: 'Supplies',
      items: [],
      source: { kind: 'manual' }
    })
    expect(c.editor.commit(request)).toEqual(saved)
  })
  it('rolls back the group and all treasures when a later write fails', () => {
    const c = setup(),
      request = c.request()
    const failing = new GroupEditorHandler(
      () => ({
        ...c.context,
        projections: {
          bumpRevision: () => {
            throw new Error('Injected failure')
          }
        }
      }),
      c.transaction
    )
    expect(() => failing.commit(request)).toThrow('Injected failure')
    expect(c.scenes.groups(c.sceneId)).toHaveLength(0)
    expect(
      c.context.projections
        .scene(c.sceneId, null, [request.prospectiveGroupId])
        .groupTreasures.flatMap((g) => g.treasures)
    ).toHaveLength(0)
    expect(c.editor.receipt(request)).toBeNull()
    expect(c.editor.commit(request).treasures).toHaveLength(1)
  })
  it('updates multiple treasures and rejects stale revisions without partial writes', () => {
    const c = setup(),
      request = c.request()
    request.treasures.push({
      ...request.treasures[0]!,
      key: 'second',
      label: 'Second'
    })
    const saved = c.editor.commit(request),
      group = saved.groupResult.scenePatch.upsertedGroups[0]!
    const update = {
      ...request,
      commandId: randomUUID(),
      groupId: group.id,
      expectedRevision: c.scenes.revision(),
      expectedGroupRevision: group.revision,
      treasures: saved.treasures.map((t) => ({
        ...editorLootPayload(t.key, editorLootFromTreasure(t.treasure))!,
        label: 'Updated'
      }))
    }
    const result = c.editor.commit(update)
    expect(result.treasures.map((t) => t.treasure.label)).toEqual([
      'Updated',
      'Updated'
    ])
    expect(() =>
      c.editor.commit({ ...update, commandId: randomUUID(), name: 'Stale' })
    ).toThrow()
    expect(c.scenes.groups(c.sceneId)[0]?.name).toBe(group.name)
  })
  it('protects distributed quantities and immutable item definitions', () => {
    const c = setup(),
      request = c.request(),
      saved = c.editor.commit(request),
      treasure = saved.treasures[0]!.treasure,
      group = saved.groupResult.scenePatch.upsertedGroups[0]!,
      item = treasure.items[0]!
    const store = c.context.treasures
    store.addAllocation({
      id: randomUUID(),
      commandId: randomUUID(),
      treasureId: treasure.id,
      itemId: item.id,
      characterId: c.party.read().members[0]!.id,
      quantity: 2,
      createdAt: new Date().toISOString()
    })
    const draft = editorLootPayload(
      'manual',
      editorLootFromTreasure(store.require(treasure.id))
    )!
    const update = {
      ...request,
      commandId: randomUUID(),
      groupId: group.id,
      expectedRevision: c.scenes.revision(),
      expectedGroupRevision: group.revision,
      treasures: [draft]
    }
    draft.items[0]!.quantity = 1
    expect(() => c.editor.commit(update)).toThrow()
    draft.items = []
    expect(() => c.editor.commit(update)).toThrow()
    expect(c.context.treasures.require(treasure.id).items[0]?.quantity).toBe(3)
    const preserved = preserveAllocatedEditorLoot(
      editorLootFromTreasure(store.require(treasure.id)),
      {
        label: 'Rerolled',
        items: [],
        containers: []
      }
    )
    expect(preserved.items[0]?.quantity).toBe(2)
    const replacement = editorLootPayload('manual', {
      ...editorLootFromTreasure(store.require(treasure.id)),
      history: createGroupLootDraftHistory(preserved)
    })!
    const result = c.editor.commit({ ...update, treasures: [replacement] })
    expect(result.treasures[0]?.treasure.items[0]).toMatchObject({
      id: item.id,
      quantity: 2,
      allocatedQuantity: 2
    })
  })
})
describe('read-only loot balance', () => {
  it('uses all four party thresholds and excludes dead members across difficulty transitions', () => {
    const c = setup()
    c.assign()
    const party = c.party.read().members.filter((m) => m.active)
    expect(party).toHaveLength(2)
    for (const [quantity, adjustedXp, label] of [
      [1, 75, 'Trivial'],
      [2, 200, 'Easy'],
      [3, 375, 'Medium'],
      [4, 500, 'Hard'],
      [7, 1050, 'Deadly']
    ] as const) {
      const e = evaluateSceneGroupDraft(c.sceneId, party, [
        { creatureId: 'wolf', quantity, deadQuantity: 5 }
      ])
      expect(e.partyThresholds).toEqual([150, 300, 450, 800])
      expect(e.baseXp).toBe(quantity * 50)
      expect(e.adjustedXp).toBe(adjustedXp)
      expect(e.difficultyLabel).toBe(label)
      expect(e.creatureCount).toBe(quantity)
    }
    const smaller = evaluateSceneGroupDraft(c.sceneId, party.slice(0, 1), [
      { creatureId: 'wolf', quantity: 3 }
    ])
    expect(smaller.partyThresholds).toEqual([75, 150, 225, 400])
    expect(smaller.difficultyLabel).toBe('Hard')
  })

  it('reports a missing party without inventing target values', () => {
    const c = setup(),
      balance = c.balance.evaluate(c.evaluate(c.request()))
    expect(balance.status).toBe('missing_party')
    expect(balance.targetValueCp).toBeNull()
    expect(balance.currentValueCp).toBe(c.item.unitValueCp * 3)
  })
  it('reports missing levels, empty living rosters and unavailable creatures explicitly', () => {
    const c = setup()
    c.assign()
    const member = c.party.read().members.find((m) => m.active)!
    c.party.update(
      member.id,
      {
        name: member.name,
        playerName: member.playerName,
        level: null,
        passivePerception: member.passivePerception,
        armorClass: member.armorClass,
        movementSpeedFeet: member.movementSpeedFeet
      },
      c.party.read().revision
    )
    expect(c.balance.evaluate(c.evaluate(c.request())).status).toBe(
      'missing_level'
    )
    c.assign()
    const request = c.evaluate(c.request())
    expect(c.balance.evaluate({ ...request, entries: [] }).status).toBe(
      'empty_roster'
    )
    expect(
      c.balance.evaluate({
        ...request,
        entries: [{ creatureId: 'wolf', quantity: 0, deadQuantity: 3 }]
      }).status
    ).toBe('empty_roster')
    expect(
      c.balance.evaluate({
        ...request,
        entries: [{ creatureId: 'unavailable', quantity: 1 }]
      }).status
    ).toBe('unavailable_creature')
  })
  it('rejects duplicate treasure replacements instead of double counting them', () => {
    const c = setup(),
      request = c.evaluate(c.request())
    request.treasures.push(request.treasures[0]!)
    expect(() => c.balance.evaluate(request)).toThrow()
  })
  it('keeps target values stable and never creates a generator run', () => {
    const c = setup()
    c.assign()
    const request = c.evaluate(c.request())
    c.db.pragma('query_only = ON')
    const first = c.balance.evaluate(request),
      second = c.balance.evaluate(request)
    c.db.pragma('query_only = OFF')
    expect(first.status).toBe('ready')
    expect(first).toEqual(second)
    expect(
      c.balance.evaluate({ ...request, treasures: [] }).targetMagic
    ).toEqual(first.targetMagic)
    expect(
      c.balance.evaluate({ ...request, treasures: [] }).targetValueCp
    ).toEqual(first.targetValueCp)
    expect(c.scenes.groups(c.sceneId)).toHaveLength(0)
  })
  it('counts unchanged treasures plus current drafts once and excludes allocations', () => {
    const c = setup()
    c.assign()
    const request = c.request()
    request.treasures.push({
      ...request.treasures[0]!,
      key: 'second',
      label: 'Second'
    })
    const saved = c.editor.commit(request),
      group = saved.groupResult.scenePatch.upsertedGroups[0]!,
      treasure = saved.treasures[0]!.treasure
    const store = c.context.treasures
    store.addAllocation({
      id: randomUUID(),
      commandId: randomUUID(),
      treasureId: treasure.id,
      itemId: treasure.items[0]!.id,
      characterId: c.party.read().members[0]!.id,
      quantity: 2,
      createdAt: new Date().toISOString()
    })
    const draft = editorLootPayload(
      'manual',
      editorLootFromTreasure(store.require(treasure.id))
    )!
    draft.items[0]!.quantity = 5
    const evaluation = c.evaluate({
      ...request,
      groupId: group.id,
      expectedRevision: c.scenes.revision(),
      expectedGroupRevision: group.revision,
      treasures: [draft]
    })
    const balance = c.balance.evaluate(evaluation)
    expect(balance.currentValueCp).toBe(c.item.unitValueCp * 6)
    expect(
      c.balance.evaluate({
        ...evaluation,
        entries: [{ creatureId: 'wolf', quantity: 8, deadQuantity: 1 }]
      }).currentValueCp
    ).toBe(balance.currentValueCp)
    expect(store.require(treasure.id).items[0]?.quantity).toBe(3)
  })
})
