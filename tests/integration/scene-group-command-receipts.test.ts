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
