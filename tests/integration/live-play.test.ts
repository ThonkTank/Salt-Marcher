import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
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
  const play = new LivePlayService(() => campaigns.activeCampaignDatabase())
  return { campaigns, play }
}

describe('live party, scene groups and combat', () => {
  it('seeds four inactive roster characters exactly once', () => {
    const { campaigns, play } = harness()
    const first = play.readParty()
    campaigns.close()

    const reopened = new CampaignStore(roots[0] ?? '')
    const second = new LivePlayService(() =>
      reopened.activeCampaignDatabase()
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

  it('assigns new party members to the focused scene and preserves manual scene removal', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    for (const member of party.members)
      party = play.setMembership(member.id, true, party.revision)

    let session = play.readSession()
    const defaultSceneId = session.scene.focusedSceneId
    expect(session.scene.scenes[0]?.partyMemberIds).toEqual(
      party.members.map((member) => member.id)
    )
    expect(session.scene.unassignedPartyMemberIds).toEqual([])

    const movingMember = party.members[0]!
    party = play.setMembership(movingMember.id, false, party.revision)
    session = play.readSession()
    expect(session.scene.scenes[0]?.partyMemberIds).not.toContain(
      movingMember.id
    )

    const secondSceneId = uuidv7()
    const db = campaigns.activeCampaignDatabase()
    db.prepare(
      "INSERT INTO scene_running_scene (id, title, location_id, location_name, position) VALUES (?, 'Nebenszene', NULL, '', 1)"
    ).run(secondSceneId)
    db.prepare(
      'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
    ).run()
    session = play.readSession()
    play.focusScene(secondSceneId, session.scene.revision)

    play.setMembership(movingMember.id, true, party.revision)
    session = play.readSession()
    expect(
      session.scene.scenes.find((scene) => scene.id === secondSceneId)
        ?.partyMemberIds
    ).toEqual([movingMember.id])
    expect(
      session.scene.scenes.find((scene) => scene.id === defaultSceneId)
        ?.partyMemberIds
    ).not.toContain(movingMember.id)

    session = play.assignScenePartyMember(
      secondSceneId,
      movingMember.id,
      false,
      session.scene.revision
    )
    expect(session.scene.unassignedPartyMemberIds).toContain(movingMember.id)
    expect(play.readSession().scene.unassignedPartyMemberIds).toContain(
      movingMember.id
    )
    campaigns.close()
  })

  it('reconciles automatically assigned members into initiative and combat', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    party = play.setMembership(party.members[0]!.id, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = play.saveSceneGroup(
      sceneId,
      null,
      'Wölfe',
      '',
      'hostile',
      [{ creatureId: 'wolf', quantity: 2 }],
      session.scene.revision
    )
    play.prepareCombat(sceneId, session.scene.revision, [
      session.scene.scenes[0]!.groups[0]!.id
    ])

    party = play.setMembership(party.members[1]!.id, true, party.revision)
    session = play.readSession()
    expect(
      session.combat?.initiativeRows.filter((row) => row.kind === 'party')
    ).toHaveLength(2)
    session = play.confirmInitiative(
      session.combat!.revision,
      session.combat!.initiativeRows.map((row) => ({
        id: row.id,
        initiative: row.initiative
      }))
    )
    const activeCardId = session.combat?.cards.find((card) => card.active)?.id

    play.setMembership(party.members[2]!.id, true, party.revision)
    session = play.readSession()
    expect(
      session.combat?.cards.filter((card) => card.playerCharacter)
    ).toHaveLength(3)
    expect(session.combat?.cards.find((card) => card.active)?.id).toBe(
      activeCardId
    )
    campaigns.close()
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
      'Hält sich im Unterholz verborgen.',
      'hostile',
      [{ creatureId: 'goblin', quantity: 4 }],
      session.scene.revision
    )
    const groupId = session.scene.scenes[0]?.groups[0]?.id
    expect(groupId).toBeDefined()

    session = play.prepareCombat(sceneId, session.scene.revision, [
      groupId ?? ''
    ])
    expect(session.combat?.phase).toBe('initiative')
    const partyInitiative = session.combat?.initiativeRows
      .filter((row) => row.kind === 'party')
      .map((row) => ({ id: row.id, initiative: row.initiative }))
    session = play.rollInitiative(session.combat?.revision ?? -1)
    expect(
      session.combat?.initiativeRows
        .filter((row) => row.kind === 'party')
        .map((row) => ({ id: row.id, initiative: row.initiative }))
    ).toEqual(partyInitiative)
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
    expect(monsterCard).toMatchObject({ count: 4, creatureId: 'goblin' })

    session = play.changeHp(
      session.combat?.revision ?? -1,
      monsterCard?.id ?? '',
      8,
      false
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ currentHp: 6, maxHp: 7, aliveCount: 3, count: 4 })
    session = play.toggleCombatCondition(
      session.combat?.revision ?? -1,
      monsterCard?.id ?? '',
      'Liegend',
      true
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
        ?.conditions
    ).toEqual(['Liegend'])
    expect(session.combat?.undoLabel).toContain('Liegend')
    session = play.undoCombat(session.combat?.revision ?? -1)
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ currentHp: 6, conditions: [] })
    session = play.undoCombat(session.combat?.revision ?? -1)
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ currentHp: 7, aliveCount: 4 })

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

  it('persists group disposition and archive state without mutating combat', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    const memberId = party.members[0]?.id ?? ''
    play.setMembership(memberId, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = play.assignScenePartyMember(
      sceneId,
      memberId,
      true,
      session.scene.revision
    )
    session = play.saveSceneGroup(
      sceneId,
      null,
      'Hafenwache',
      '',
      'allied',
      [],
      session.scene.revision
    )
    const emptyGroup = session.scene.scenes[0]?.groups[0]
    expect(emptyGroup).toMatchObject({
      disposition: 'allied',
      archived: false,
      baseXp: 0,
      entries: []
    })
    expect(
      play.evaluateEncounter(
        sceneId,
        [emptyGroup?.id ?? ''],
        session.scene.revision
      ).canStart
    ).toBe(false)

    session = play.saveSceneGroup(
      sceneId,
      null,
      'Goblins',
      '',
      'hostile',
      [{ creatureId: 'goblin', quantity: 2 }],
      session.scene.revision
    )
    const combatGroup = session.scene.scenes[0]?.groups[1]
    session = play.prepareCombat(sceneId, session.scene.revision, [
      combatGroup?.id ?? ''
    ])
    const combatBeforeArchive = session.combat
    session = play.setSceneGroupArchived(
      sceneId,
      combatGroup?.id ?? '',
      true,
      session.scene.revision
    )
    expect(session.combat).toEqual(combatBeforeArchive)
    expect(
      session.scene.scenes[0]?.groups.find(
        (group) => group.id === combatGroup?.id
      )?.archived
    ).toBe(true)
    expect(() =>
      play.evaluateEncounter(
        sceneId,
        [combatGroup?.id ?? ''],
        session.scene.revision
      )
    ).toThrow('validation')

    session = play.deleteSceneGroup(
      sceneId,
      combatGroup?.id ?? '',
      session.scene.revision
    )
    expect(session.combat).toEqual(combatBeforeArchive)
    expect(session.scene.scenes[0]?.groups).toHaveLength(1)
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
      'Streift im Dünengras westlich der Furt.',
      'hostile',
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
    const monsterCard = session.combat?.cards.find(
      (card) => !card.playerCharacter
    )
    session = play.toggleCombatCondition(
      session.combat?.revision ?? -1,
      monsterCard?.id ?? '',
      'Vergiftet',
      true
    )
    session = play.advanceTurn(session.combat?.revision ?? -1)
    const expected = session.combat
    campaigns.close()

    const reopened = new CampaignStore(roots[0] ?? '')
    const resumed = new LivePlayService(() =>
      reopened.activeCampaignDatabase()
    ).readSession()
    reopened.close()

    expect(resumed.combat).toEqual(expected)
    expect(resumed.scene.scenes[0]?.groups[0]?.note).toBe(
      'Streift im Dünengras westlich der Furt.'
    )
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
      '',
      'hostile',
      [{ creatureId: 'wolf', quantity: 2 }],
      session.scene.revision
    )
    session = play.prepareCombat(firstSceneId, session.scene.revision, [
      session.scene.scenes[0]?.groups[0]?.id ?? ''
    ])
    const firstCombat = session.combat

    const secondSceneId = uuidv7()
    const db = campaigns.activeCampaignDatabase()
    db.prepare(
      "INSERT INTO scene_running_scene (id, title, location_id, location_name, position) VALUES (?, 'Nebenszene', NULL, '', 1)"
    ).run(secondSceneId)
    db.prepare(
      'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
    ).run()
    session = play.readSession()
    session = play.focusScene(secondSceneId, session.scene.revision)
    expect(session.combat).toBeNull()
    session = play.focusScene(firstSceneId, session.scene.revision)
    expect(session.combat).toEqual(firstCombat)
    campaigns.close()
  })
})
