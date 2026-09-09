import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import type { SceneGroupLifecycleCommand } from '../../src/shared/contracts/scene-group-lifecycle.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { createSessionHandlers } from '../../src/utility/composition/live-play.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import type { SaveSceneGroupInput } from '../../src/shared/contracts/scene.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'

const roots: string[] = []
const stores: CampaignStore[] = []
afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-group-receipt-'))
  roots.push(root)
  const store = new CampaignStore(root)
  stores.push(store)
  store.create('Group receipt test')
  const play = new LivePlayService(store.activeCampaignPersistence())
  const snapshot = play.readSession()
  const input: SaveSceneGroupInput = {
    commandId: randomUUID(),
    sceneId: snapshot.scene.focusedSceneId,
    groupId: null,
    name: 'Created once',
    note: '',
    disposition: 'hostile',
    entries: [],
    expectedRevision: snapshot.scene.revision,
    expectedGroupRevision: null
  }
  return { root, store, play, input, db: activeCampaignDatabase(store) }
}

describe('scene group command receipts', () => {
  it('rejects a receipt read for another campaign before consulting its database', () => {
    const { store, play, input } = harness()
    const handlers = createSessionHandlers(play, () => store.activeCampaignId())
    expect(() =>
      handlers['scene.groupSaveReceipt']({ ...input, campaignId: randomUUID() })
    ).toThrow('stale')
    expect(
      handlers['scene.groupSaveReceipt']({
        ...input,
        campaignId: store.activeCampaignId()
      })
    ).toBeNull()
    const result = play.saveSceneGroupCommand(input)
    expect(
      handlers['scene.groupSaveReceipt']({
        ...input,
        campaignId: store.activeCampaignId()
      })
    ).toEqual(result)
  })

  it('creates once, replays the exact result, rejects changed requests, and reads after restart', () => {
    const { root, store, play, input, db } = harness()
    expect(play.sceneGroupSaveReceipt(input)).toBeNull()
    const result = play.saveSceneGroupCommand(input)
    const before = play.readSession()
    expect(play.saveSceneGroupCommand(input)).toEqual(result)
    expect(play.readSession()).toEqual(before)
    expect(before.scene.scenes[0]?.groups).toHaveLength(1)
    expect(() =>
      play.saveSceneGroupCommand({ ...input, name: 'Different request' })
    ).toThrow('idempotency_conflict')
    db.pragma('query_only = ON')
    try {
      expect(play.sceneGroupSaveReceipt(input)).toEqual(result)
      expect(
        play.sceneGroupSaveReceipt({ ...input, commandId: randomUUID() })
      ).toBeNull()
      expect(() =>
        play.sceneGroupSaveReceipt({ ...input, name: 'Different request' })
      ).toThrow('idempotency_conflict')
    } finally {
      db.pragma('query_only = OFF')
    }
    store.close()
    stores.splice(stores.indexOf(store), 1)
    const reopened = new CampaignStore(root)
    stores.push(reopened)
    const restarted = new LivePlayService(reopened.activeCampaignPersistence())
    expect(restarted.sceneGroupSaveReceipt(input)).toEqual(result)
    expect(restarted.saveSceneGroupCommand(input)).toEqual(result)
    expect(restarted.readSession()).toEqual(before)
  })

  it('rolls back the group and its revision when receipt recording fails', () => {
    const { play, input, db } = harness()
    const before = play.readSession()
    db.exec(
      "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON scene_group_command_receipt BEGIN SELECT RAISE(ABORT, 'receipt failure'); END"
    )
    expect(() => play.saveSceneGroupCommand(input)).toThrow('receipt failure')
    expect(play.readSession()).toEqual(before)
    expect(play.sceneGroupSaveReceipt(input)).toBeNull()
    db.exec('DROP TRIGGER fail_receipt')
    play.saveSceneGroupCommand(input)
    expect(play.readSession().scene.scenes[0]?.groups).toHaveLength(1)
  })

  it('records edits independently and never reapplies an old receipt over later work', () => {
    const { play, input } = harness()
    const created = play.saveSceneGroupCommand(input)
    const group = created.scenePatch.upsertedGroups[0]!
    const edit = {
      ...input,
      commandId: randomUUID(),
      groupId: group.id,
      name: 'Later work',
      expectedRevision: created.scenePatch.sceneRevision,
      expectedGroupRevision: group.revision
    }
    const edited = play.saveSceneGroupCommand(edit)
    const beforeReplay = play.readSession()
    expect(play.saveSceneGroupCommand(input)).toEqual(created)
    expect(play.saveSceneGroupCommand(edit)).toEqual(edited)
    expect(play.readSession()).toEqual(beforeReplay)
    expect(beforeReplay.scene.scenes[0]?.groups[0]?.name).toBe('Later work')
  })
})

describe('group lifecycle original receipts', () => {
  it.each(['archive', 'restore', 'delete'] as const)(
    'persists %s once, rolls back journal failures and survives later work and restart',
    (mode) => {
      const { root, store, play, input, db } = harness()
      seedExampleParty(db)
      const member = play.readParty().members[0]!
      play.setMembership(member.id, true, play.readParty().revision)
      play.saveSceneGroupCommand({
        ...input,
        expectedRevision: play.readSession().scene.revision,
        entries: [{ creatureId: 'wolf', quantity: 2 }]
      })
      let snapshot = play.readSession()
      const sceneId = snapshot.scene.focusedSceneId
      let group = snapshot.scene.scenes[0]!.groups[0]!
      play.prepareCombat(sceneId, snapshot.scene.revision, [group.id])
      const prepared = play.readSession().combat!
      play.confirmInitiative(
        prepared.revision,
        prepared.initiativeRows.map((row) => ({
          id: row.id,
          initiative: row.initiative
        }))
      )
      expect(
        play
          .readSession()
          .combat?.cards.some((card) => card.creatureId === 'wolf')
      ).toBe(true)
      if (mode !== 'archive') {
        play.setSceneGroupArchived(sceneId, group.id, true, group.revision)
        group = play.readSession().scene.scenes[0]!.groups[0]!
      }
      snapshot = play.readSession()
      const base = {
        sceneId,
        groupId: group.id,
        expectedGroupRevision: group.revision
      }
      const command: SceneGroupLifecycleCommand = {
        commandId: randomUUID(),
        command:
          mode === 'delete'
            ? { kind: 'delete', input: base }
            : {
                kind: 'archive',
                input: { ...base, archived: mode === 'archive' }
              }
      }
      const handlers = createSessionHandlers(play, () =>
        store.activeCampaignId()
      )
      for (const name of [
        'scene.executeGroupLifecycle',
        'scene.groupLifecycleStatus'
      ] as const)
        expect(() =>
          handlers[name]({ ...command, campaignId: randomUUID() })
        ).toThrow('stale')
      db.pragma('query_only = ON')
      expect(play.sceneGroupLifecycleStatus(command)).toEqual({
        receipt: null,
        snapshot
      })
      db.pragma('query_only = OFF')
      db.exec(
        "CREATE TEMP TRIGGER fail_lifecycle_receipt BEFORE INSERT ON scene_group_command_receipt BEGIN SELECT RAISE(ABORT, 'receipt failure'); END"
      )
      expect(() => play.executeSceneGroupLifecycle(command)).toThrow(
        'receipt failure'
      )
      expect(play.readSession()).toEqual(snapshot)
      expect(play.sceneGroupLifecycleStatus(command).receipt).toBeNull()
      db.exec('DROP TRIGGER fail_lifecycle_receipt')
      const receipt = handlers['scene.executeGroupLifecycle']({
        ...command,
        campaignId: store.activeCampaignId()
      })
      const applied = play.readSession()
      const afterGroup = applied.scene.scenes[0]!.groups.find(
        (candidate) => candidate.id === group.id
      )
      if (mode === 'delete') expect(afterGroup).toBeUndefined()
      else expect(afterGroup?.archived).toBe(mode === 'archive')
      if (mode === 'archive')
        expect(
          applied.combat?.cards.some((card) => card.creatureId === 'wolf')
        ).toBe(false)
      expect(play.executeSceneGroupLifecycle(command)).toEqual(receipt)
      expect(play.readSession()).toEqual(applied)
      play.saveSceneGroup(
        sceneId,
        null,
        'Later work',
        '',
        'neutral',
        [],
        applied.scene.revision,
        null
      )
      const later = play.readSession()
      db.pragma('query_only = ON')
      expect(play.sceneGroupLifecycleStatus(command)).toEqual({
        receipt,
        snapshot: later
      })
      expect(() =>
        play.sceneGroupLifecycleStatus({
          ...command,
          command: {
            ...command.command,
            input: { ...command.command.input, expectedGroupRevision: 99 }
          }
        } as SceneGroupLifecycleCommand)
      ).toThrow('idempotency_conflict')
      db.pragma('query_only = OFF')
      store.close()
      const reopened = new CampaignStore(root)
      stores.push(reopened)
      const restarted = new LivePlayService(
        reopened.activeCampaignPersistence()
      )
      expect(restarted.executeSceneGroupLifecycle(command)).toEqual(receipt)
      expect(restarted.readSession()).toEqual(later)
    }
  )

  it('archives the named scene combat while another scene remains focused', () => {
    const { store, play, input, db } = harness()
    seedExampleParty(db)
    const member = play.readParty().members[0]!
    play.setMembership(member.id, true, play.readParty().revision)
    play.saveSceneGroupCommand({
      ...input,
      expectedRevision: play.readSession().scene.revision,
      entries: [{ creatureId: 'wolf', quantity: 2 }]
    })
    const first = play.readSession()
    const group = first.scene.scenes[0]!.groups[0]!
    play.prepareCombat(input.sceneId, first.scene.revision, [group.id])
    const prepared = play.readSession().combat!
    play.confirmInitiative(
      prepared.revision,
      prepared.initiativeRows.map((row) => ({
        id: row.id,
        initiative: row.initiative
      }))
    )
    expect(
      play
        .readSession()
        .combat?.cards.some((card) => card.creatureId === 'wolf')
    ).toBe(true)
    const otherId = new SceneStore(db).createFromScene(
      input.sceneId,
      'Other scene'
    )
    play.focusScene(otherId, play.readSession().scene.revision)
    const otherCombat = play.readSession().combat
    const receipt = play.executeSceneGroupLifecycle({
      commandId: randomUUID(),
      command: {
        kind: 'archive',
        input: {
          sceneId: input.sceneId,
          groupId: group.id,
          archived: true,
          expectedGroupRevision: group.revision
        }
      }
    })
    expect(play.readSession().scene.focusedSceneId).toBe(otherId)
    expect(play.readSession().combat).toEqual(otherCombat)
    expect(
      receipt.combat?.cards.some((card) => card.creatureId === 'wolf')
    ).toBe(false)
    play.focusScene(input.sceneId, play.readSession().scene.revision)
    expect(
      play
        .readSession()
        .combat?.cards.some((card) => card.creatureId === 'wolf')
    ).toBe(false)
    expect(store.activeCampaignId()).toBeTruthy()
  })
})
