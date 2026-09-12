import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { PartyActionService } from '../../src/core/application/party-action-service.js'
import { restProgress } from '../../src/renderer/features/scene-desktop/party-progress.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-party-history-'))
  const campaigns = new CampaignStore(root)
  campaigns.create('Party')
  const play = new LivePlayService(campaigns.activeCampaignPersistence())
  play.createPartyCharacter(
    {
      name: 'Mira',
      playerName: 'Test',
      level: 5,
      armorClass: 16,
      passivePerception: 12
    },
    0
  )
  const id = play.readParty().members[0]!.id
  play.setMembership(id, true, play.readParty().revision)
  const actions = () =>
    new PartyActionService(
      campaigns.activeCampaignPersistence(),
      campaigns.installationPersistenceAccess(),
      () => campaigns.activeCampaignId(),
      play
    )
  return {
    root,
    campaigns,
    play,
    id,
    actions,
    close: () => {
      campaigns.close()
      rmSync(root, { recursive: true, force: true })
    }
  }
}
it('persists XP undo/redo with monotonic revisions, branches and field conflicts', () => {
  const h = fixture()
  try {
    const xp = (delta: number) =>
      h.actions().executeCharacter({
        commandId: randomUUID(),
        command: {
          kind: 'adjust-xp',
          input: {
            id: h.id,
            delta,
            expectedRevision: h.play.readParty().revision
          }
        }
      })
    const move = (direction: 'undo' | 'redo') =>
      h.actions().undoRedo({
        campaignId: h.campaigns.activeCampaignId(),
        commandId: randomUUID(),
        direction,
        stepId: h.actions().history()[direction]!.id
      })
    xp(1000)
    xp(2000)
    const revision = h.play.readParty().revision
    move('undo')
    expect(h.play.readParty().members[0]!.xp).toBe(7500)
    move('undo')
    expect(h.play.readParty().members[0]!.xp).toBe(6500)
    move('redo')
    expect(h.play.readParty().members[0]!.xp).toBe(7500)
    expect(h.play.readParty().revision).toBeGreaterThan(revision)
    xp(-7000)
    expect(h.actions().history().redo).toBeNull()
    expect(h.play.readParty().members[0]).toMatchObject({ xp: 500, level: 2 })
    h.play.adjustPartyXp(h.id, 5, h.play.readParty().revision)
    expect(h.actions().history().undo?.blockedReason).toContain('später')
  } finally {
    h.close()
  }
})
it('closes early rest sections at actual burden, preserves extra rests and restores atomically', () => {
  const h = fixture()
  try {
    const db = activeCampaignDatabase(h.campaigns)
    const rest = (type: 'short' | 'long') => {
      const current = h.play.readSession()
      return h.actions().executeScene({
        commandId: randomUUID(),
        command: {
          kind: 'rest-selected',
          input: {
            sceneId: current.scene.focusedSceneId,
            memberIds: [h.id],
            type,
            expectedRevision: current.party.revision,
            expectedSceneRevision: current.scene.revision
          }
        }
      })
    }
    db.prepare(
      'UPDATE player_characters SET xp_since_long_rest = 700, xp_since_short_rest = 700 WHERE id = ?'
    ).run(h.id)
    rest('short')
    let member = h.play.readParty().members[0]!
    expect(member.burden).toMatchObject({
      completedShortRestSections: 1,
      sectionStartXp: 700,
      sectionsTrusted: true
    })
    expect(restProgress(member)).toMatchObject({ fill: 0, sections: 2 })
    db.prepare(
      'UPDATE player_characters SET xp_since_long_rest = 2100, xp_since_short_rest = 1400 WHERE id = ?'
    ).run(h.id)
    expect(restProgress(h.play.readParty().members[0]!)).toMatchObject({
      fill: 0.5,
      sections: 2
    })
    rest('short')
    rest('short')
    member = h.play.readParty().members[0]!
    expect(member.burden).toMatchObject({
      completedShortRestSections: 2,
      sectionStartXp: 2100
    })
    rest('long')
    h.actions().undoRedo({
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'undo',
      stepId: h.actions().history().undo!.id
    })
    expect(h.play.readParty().members[0]!.burden).toEqual(member.burden)
    expect(h.play.readParty().members[0]!.xpSinceLongRest).toBe(2100)
  } finally {
    h.close()
  }
})
it('moves to an unnamed scene and undoes creation together with membership', () => {
  const h = fixture()
  try {
    const before = h.play.readSession()
    const command = {
      commandId: randomUUID(),
      command: {
        kind: 'move-roster' as const,
        input: {
          sceneId: before.scene.focusedSceneId,
          memberIds: [h.id],
          expectedRevision: before.scene.revision,
          expectedPartyRevision: before.party.revision,
          target: { kind: 'new' as const }
        }
      }
    }
    h.actions().executeScene(command)
    expect(h.play.readSession().scene.scenes).toHaveLength(2)
    h.actions().undoRedo({
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'undo',
      stepId: h.actions().history().undo!.id
    })
    expect(h.play.readSession().scene.scenes).toHaveLength(1)
    expect(h.play.readSession().scene.scenes[0]!.partyMemberIds).toEqual([h.id])
    // Replaying the original command returns its original receipt without performing the move again.
    h.actions().executeScene(command)
    expect(h.play.readSession().scene.scenes).toHaveLength(1)
  } finally {
    h.close()
  }
})

it('recovers a committed preference action across the installation boundary and preserves unrelated settings', () => {
  const h = fixture()
  try {
    const installation = h.campaigns
      .installationPersistenceAccess()
      .use((db) => db)
    installation.exec(
      "CREATE TEMP TRIGGER fail_history_index BEFORE INSERT ON party_history_index BEGIN SELECT RAISE(ABORT, 'interrupted'); END"
    )
    const before = h.campaigns.readSettings()
    const command = {
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      fields: ['level' as const],
      expectedRevision: before.revision
    }
    expect(() => h.actions().quickFields(command)).toThrow()
    expect(h.campaigns.readSettings()).toEqual(before)
    installation.exec('DROP TRIGGER fail_history_index')
    expect(h.actions().status(command).committed).toBe(true)
    expect(h.campaigns.readSettings().preferences.partyQuickFields).toEqual([
      'level'
    ])
    const revision = h.campaigns.readSettings().revision
    h.actions().quickFields(command)
    expect(h.campaigns.readSettings().revision).toBe(revision)
    const current = h.campaigns.readSettings()
    h.campaigns.updateSettings(
      { partyQuickFields: ['languages'] },
      current.revision
    )
    expect(h.actions().history().undo?.blockedReason).toContain('Schnellwerte')
  } finally {
    h.close()
  }
})

it('retains a bounded chronological history across a real database restart', () => {
  const h = fixture()
  let reopened: CampaignStore | null = null
  try {
    for (let i = 0; i < 102; i++)
      h.actions().executeCharacter({
        commandId: randomUUID(),
        command: {
          kind: 'adjust-xp',
          input: {
            id: h.id,
            delta: 1,
            expectedRevision: h.play.readParty().revision
          }
        }
      })
    expect(
      activeCampaignDatabase(h.campaigns)
        .prepare('SELECT count(*) AS count FROM party_action_history')
        .get()
    ).toEqual({ count: 100 })
    const campaignId = h.campaigns.activeCampaignId()
    const last = h.actions().history().undo!.id
    h.campaigns.close()
    reopened = new CampaignStore(h.root)
    const play = new LivePlayService(reopened.activeCampaignPersistence())
    const actions = new PartyActionService(
      reopened.activeCampaignPersistence(),
      reopened.installationPersistenceAccess(),
      () => campaignId,
      play
    )
    expect(actions.history().undo!.id).toBe(last)
    const command = {
      campaignId,
      commandId: randomUUID(),
      direction: 'undo' as const,
      stepId: last
    }
    actions.undoRedo(command)
    const once = play.readParty()
    actions.undoRedo(command)
    expect(play.readParty()).toEqual(once)
    expect(actions.history().redo!.id).toBe(last)
  } finally {
    reopened?.close()
    h.close()
  }
})

it('rolls back owner changes when recording history fails and does not overwrite later profile fields', () => {
  const h = fixture()
  try {
    const db = activeCampaignDatabase(h.campaigns)
    const before = h.play.readParty()
    const command = {
      commandId: randomUUID(),
      command: {
        kind: 'adjust-xp' as const,
        input: { id: h.id, delta: 100, expectedRevision: before.revision }
      }
    }
    db.exec(
      "CREATE TEMP TRIGGER fail_party_history BEFORE INSERT ON party_action_history BEGIN SELECT RAISE(ABORT, 'interrupted'); END"
    )
    expect(() => h.actions().executeCharacter(command)).toThrow()
    expect(h.play.readParty()).toEqual(before)
    expect(h.play.partyCharacterCommandStatus(command).receipt).toBeNull()
    db.exec('DROP TRIGGER fail_party_history')
    h.actions().executeCharacter(command)
    db.prepare('UPDATE player_characters SET player_name = ? WHERE id = ?').run(
      'Spätere Spieleränderung',
      h.id
    )
    h.actions().undoRedo({
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'undo',
      stepId: h.actions().history().undo!.id
    })
    expect(h.play.readParty().members[0]).toMatchObject({
      xp: 6500,
      playerName: 'Spätere Spieleränderung'
    })
  } finally {
    h.close()
  }
})

it('restores roster and combat together, but blocks a later combat edit', () => {
  const h = fixture()
  try {
    let snapshot = h.play.readSession()
    const source = snapshot.scene.focusedSceneId
    h.play.saveSceneGroup(
      source,
      null,
      'Wölfe',
      '',
      'hostile',
      [{ creatureId: 'wolf', quantity: 2 }],
      snapshot.scene.revision,
      null
    )
    snapshot = h.play.readSession()
    h.play.prepareCombat(source, snapshot.scene.revision, [
      snapshot.scene.scenes[0]!.groups[0]!.id
    ])
    const before = h.play.readSession()
    h.actions().executeScene({
      commandId: randomUUID(),
      command: {
        kind: 'set-roster',
        input: {
          sceneId: source,
          memberIds: [],
          expectedRevision: before.scene.revision,
          expectedPartyRevision: before.party.revision
        }
      }
    })
    expect(h.play.readParty().members[0]!.active).toBe(false)
    const stepId = h.actions().history().undo!.id
    h.actions().undoRedo({
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'undo',
      stepId
    })
    expect(h.play.readParty().members[0]!.active).toBe(true)
    expect(h.play.readSession().combat?.initiativeRows).toEqual(
      before.combat?.initiativeRows
    )
    h.actions().undoRedo({
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'redo',
      stepId
    })
    h.play.rollInitiative(h.play.readSession().combat!.revision)
    expect(h.actions().history().undo?.blockedReason).toContain('Kampf')
  } finally {
    h.close()
  }
})

it('undoes loot by appending linked corrections and blocks external corrections', () => {
  const h = fixture()
  try {
    const db = activeCampaignDatabase(h.campaigns)
    const award = randomUUID()
    db.prepare(
      "INSERT INTO character_loot_entry (id,command_id,character_id,source,item_reference_json,quantity,status,provenance_kind,provenance_treasure_label,provenance_recipient_name,received_at) VALUES (?,?,?,'award','{}',1,'received','treasure_distribution','Fund','Mira','2026-09-12')"
    ).run(award, randomUUID(), h.id)
    db.prepare('INSERT INTO character_loot_ledger_metadata VALUES (?,1)').run(
      h.id
    )
    const original = db
      .prepare('SELECT * FROM character_loot_entry WHERE id = ?')
      .get(award)
    const correction = randomUUID()
    const commandId = randomUUID()
    h.actions().correctLoot({ commandId }, () => {
      db.prepare(
        "INSERT INTO character_loot_entry (id,command_id,character_id,source,item_reference_json,quantity,status,provenance_kind,provenance_treasure_label,provenance_recipient_name,corrects_entry_id,correction_reason,received_at) VALUES (?,?,?,'correction','{}',3,'received','treasure_distribution','Fund','Mira',?,'Korrektur','2026-09-12')"
      ).run(correction, commandId, h.id, award)
      return { id: correction }
    })
    const stepId = h.actions().history().undo!.id
    const inverse = {
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'undo' as const,
      stepId
    }
    h.actions().undoRedo(inverse)
    h.actions().undoRedo(inverse)
    const leaf = () =>
      db
        .prepare(
          'SELECT e.id,e.quantity,e.status FROM character_loot_entry e LEFT JOIN character_loot_entry correction ON correction.corrects_entry_id = e.id WHERE correction.id IS NULL'
        )
        .get() as { id: string; quantity: number; status: string }
    expect(leaf().quantity).toBe(1)
    expect(
      db.prepare('SELECT count(*) AS count FROM character_loot_entry').get()
    ).toEqual({ count: 3 })
    h.actions().undoRedo({
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'redo',
      stepId
    })
    expect(leaf().quantity).toBe(3)
    expect(
      db.prepare('SELECT * FROM character_loot_entry WHERE id = ?').get(award)
    ).toEqual(original)
    db.prepare('UPDATE character_loot_entry SET status = ? WHERE id = ?').run(
      'sold',
      leaf().id
    )
    expect(h.actions().history().undo?.blockedReason).toContain('Loot')
  } finally {
    h.close()
  }
})

it('matches authoritative XP previews through level changes and preserves consumed burden', () => {
  const h = fixture()
  try {
    const db = activeCampaignDatabase(h.campaigns)
    db.prepare(
      'UPDATE player_characters SET xp_since_short_rest = 200, xp_since_long_rest = 700 WHERE id = ?'
    ).run(h.id)
    for (const [mode, amount] of [
      ['add', 8000],
      ['subtract', 20000],
      ['set', 355000]
    ] as const) {
      const revision = h.play.readParty().revision
      const preview = h.play.previewPartyXp(h.id, amount, revision)
      h.actions().executeCharacter({
        commandId: randomUUID(),
        command:
          mode === 'set'
            ? {
                kind: 'set-xp',
                input: { id: h.id, amount, expectedRevision: revision }
              }
            : {
                kind: 'adjust-xp',
                input: {
                  id: h.id,
                  delta: mode === 'add' ? amount : -amount,
                  expectedRevision: revision
                }
              }
      })
      const member = h.play.readParty().members[0]!
      expect(member.xp).toBe(preview[mode])
      expect(member).toMatchObject({
        xpSinceShortRest: 200,
        xpSinceLongRest: 700
      })
    }
    expect(h.play.readParty().members[0]).toMatchObject({
      level: 20,
      nextLevelXp: null
    })
  } finally {
    h.close()
  }
})

it('invalidates history on a successful replacement but preserves it if staging rolls back', () => {
  const h = fixture()
  try {
    const command = {
      commandId: randomUUID(),
      command: {
        kind: 'adjust-xp' as const,
        input: {
          id: h.id,
          delta: 25,
          expectedRevision: h.play.readParty().revision
        }
      }
    }
    h.actions().executeCharacter(command)
    const campaignId = h.campaigns.activeCampaignId()
    expect(() =>
      h.campaigns.stageImportedCampaign('Failed', campaignId, () => {
        throw new Error('staging failed')
      })
    ).toThrow('staging failed')
    expect(h.actions().history().undo?.id).toBe(command.commandId)
    h.campaigns.stageImportedCampaign('Replaced', campaignId, () => undefined)
    expect(h.actions().history()).toMatchObject({ undo: null, redo: null })
    expect(h.play.partyCharacterCommandStatus(command).receipt).not.toBeNull()
  } finally {
    h.close()
  }
})

it('restores membership-paused travel and rejects a later route change', () => {
  const h = fixture()
  try {
    const db = activeCampaignDatabase(h.campaigns)
    const sceneId = h.play.readSession().scene.focusedSceneId
    db.prepare(
      "INSERT INTO hex_map VALUES ('019b1234-1234-7000-8000-000000000099', 'Map', 0, 0, 0)"
    ).run()
    db.prepare(
      "INSERT INTO hex_journey VALUES (?, 1, '019b1234-1234-7000-8000-000000000099', 'travelling', 0, ?, 1, 1, NULL, 'travelling')"
    ).run(sceneId, JSON.stringify([h.id]))
    db.prepare(
      "INSERT INTO hex_journey_path VALUES (?, 0, '019b1234-1234-7000-8000-000000000099', 0, 0)"
    ).run(sceneId)
    const before = h.play.readSession()
    h.actions().executeScene({
      commandId: randomUUID(),
      command: {
        kind: 'set-roster',
        input: {
          sceneId,
          memberIds: [],
          expectedRevision: before.scene.revision,
          expectedPartyRevision: before.party.revision
        }
      }
    })
    expect(db.prepare('SELECT status FROM hex_journey').get()).toEqual({
      status: 'paused'
    })
    const undo = {
      campaignId: h.campaigns.activeCampaignId(),
      commandId: randomUUID(),
      direction: 'undo' as const,
      stepId: h.actions().history().undo!.id
    }
    h.actions().undoRedo(undo)
    expect(db.prepare('SELECT status FROM hex_journey').get()).toEqual({
      status: 'travelling'
    })
    h.actions().undoRedo({
      ...undo,
      commandId: randomUUID(),
      direction: 'redo'
    })
    db.prepare('UPDATE hex_journey_path SET q = 1').run()
    expect(h.actions().history().undo?.blockedReason).toContain('Reise')
    expect(() =>
      h.actions().undoRedo({ ...undo, commandId: randomUUID() })
    ).toThrow()
    expect(h.play.readParty().members[0]!.active).toBe(false)
  } finally {
    h.close()
  }
})
