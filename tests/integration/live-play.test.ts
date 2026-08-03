import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import Database from 'better-sqlite3'
import { uuidv7 } from '../../src/shared/ids/uuidv7.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-live-play-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('Test Campaign')
  const play = new LivePlayService(() => campaigns.activeCampaignPath())
  return { campaigns, play }
}

describe('live party, scene groups and combat', () => {
  it('seeds four inactive roster characters exactly once', () => {
    const { campaigns, play } = harness()
    const first = play.readParty()
    campaigns.close()

    const reopened = new CampaignStore(roots[0] ?? '')
    const second = new LivePlayService(() =>
      reopened.activeCampaignPath()
    ).readParty()
    reopened.close()

    expect(first.members.map((member) => member.name)).toEqual([
      'Alrik',
      'Brynn',
      'Cora',
      'Dain'
    ])
    expect(first.members.every((member) => !member.active)).toBe(true)
    expect(second).toEqual(first)
  })

  it('runs party and a monster group through resolution and awards XP once', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    for (const member of party.members.slice(0, 2))
      party = play.setMembership(member.id, true, party.revision)

    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    for (const member of party.members.filter((entry) => entry.active))
      session = play.assignScenePartyMember(
        sceneId,
        member.id,
        true,
        session.scene.revision
      )
    session = play.saveSceneGroup(
      sceneId,
      null,
      'Goblin Patrol',
      [{ creatureId: 'goblin', quantity: 4 }],
      session.scene.revision
    )
    const groupId = session.scene.scenes[0]?.groups[0]?.id
    expect(groupId).toBeDefined()

    session = play.prepareCombat(sceneId, session.scene.revision, [
      groupId ?? ''
    ])
    expect(session.combat?.phase).toBe('initiative')
    const initiatives =
      session.combat?.initiativeRows.map((row) => ({
        id: row.id,
        initiative: row.initiative
      })) ?? []
    session = play.confirmInitiative(
      session.combat?.revision ?? -1,
      initiatives
    )
    const monsterCard = session.combat?.cards.find(
      (card) => !card.playerCharacter
    )
    expect(monsterCard?.count).toBe(4)

    session = play.changeHp(
      session.combat?.revision ?? -1,
      monsterCard?.id ?? '',
      28,
      false
    )
    expect(session.combat?.allEnemiesDefeated).toBe(true)
    session = play.endCombat(session.combat?.revision ?? -1)
    const enemyIds =
      session.combat?.resolution?.enemies.map((enemy) => enemy.id) ?? []
    session = play.updateResolution(
      session.combat?.revision ?? -1,
      enemyIds,
      1,
      1
    )
    session = play.awardXp(session.combat?.revision ?? -1)

    expect(session.combat?.resolution?.xpAwarded).toBe(true)
    expect(session.combat?.resolution?.perPlayerXp).toBe(100)
    expect(
      session.party.members
        .filter((member) => member.active)
        .map((member) => member.xp)
    ).toEqual([1000, 1000])
    expect(() => play.awardXp(session.combat?.revision ?? -1)).toThrow(
      'validation'
    )
    campaigns.close()
  })

  it('resumes the exact running combat after reopening the campaign', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    play.setMembership(party.members[0]?.id ?? '', true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = play.assignScenePartyMember(
      sceneId,
      party.members[0]?.id ?? '',
      true,
      session.scene.revision
    )
    session = play.saveSceneGroup(
      sceneId,
      null,
      'Wolves',
      [{ creatureId: 'wolf', quantity: 2 }],
      session.scene.revision
    )
    session = play.prepareCombat(sceneId, session.scene.revision, [
      session.scene.scenes[0]?.groups[0]?.id ?? ''
    ])
    session = play.confirmInitiative(
      session.combat?.revision ?? -1,
      session.combat?.initiativeRows.map((row) => ({
        id: row.id,
        initiative: row.initiative
      })) ?? []
    )
    session = play.advanceTurn(session.combat?.revision ?? -1)
    const expected = session.combat
    campaigns.close()

    const reopened = new CampaignStore(roots[0] ?? '')
    const resumed = new LivePlayService(() =>
      reopened.activeCampaignPath()
    ).readSession()
    reopened.close()

    expect(resumed.combat).toEqual(expected)
  })

  it('keeps combat bound to its scene while focus changes', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    const memberId = party.members[0]?.id ?? ''
    play.setMembership(memberId, true, party.revision)
    let session = play.readSession()
    const firstSceneId = session.scene.focusedSceneId
    session = play.assignScenePartyMember(
      firstSceneId,
      memberId,
      true,
      session.scene.revision
    )
    session = play.saveSceneGroup(
      firstSceneId,
      null,
      'Wölfe',
      [{ creatureId: 'wolf', quantity: 2 }],
      session.scene.revision
    )
    session = play.prepareCombat(firstSceneId, session.scene.revision, [
      session.scene.scenes[0]?.groups[0]?.id ?? ''
    ])
    const firstCombat = session.combat

    const secondSceneId = uuidv7()
    const db = new Database(campaigns.activeCampaignPath())
    db.prepare(
      "INSERT INTO scene_running_scene (id, title, location_id, location_name, position) VALUES (?, 'Nebenszene', NULL, '', 1)"
    ).run(secondSceneId)
    db.prepare(
      'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
    ).run()
    db.close()

    session = play.readSession()
    session = play.focusScene(secondSceneId, session.scene.revision)
    expect(session.combat).toBeNull()
    session = play.focusScene(firstSceneId, session.scene.revision)
    expect(session.combat).toEqual(firstCombat)
    campaigns.close()
  })
})
