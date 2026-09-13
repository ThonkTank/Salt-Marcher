import { randomUUID } from 'node:crypto'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { CombatRepository } from '../../src/core/encounter/combat-repository.js'
import { HexMapStore } from '../../src/core/hex/hex-map-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'

export const historyCases = [
  {
    name: 'small',
    characters: 6,
    scenes: 2,
    foreignStates: 0,
    actors: 0,
    history: 0,
    path: 0
  },
  {
    name: 'roster',
    characters: 100,
    scenes: 2,
    foreignStates: 0,
    actors: 0,
    history: 0,
    path: 0
  },
  {
    name: 'scenes',
    characters: 6,
    scenes: 100,
    foreignStates: 0,
    actors: 0,
    history: 0,
    path: 0
  },
  {
    name: 'state-control',
    characters: 6,
    scenes: 12,
    foreignStates: 0,
    actors: 0,
    history: 0,
    path: 0
  },
  {
    name: 'states-small',
    characters: 6,
    scenes: 12,
    foreignStates: 10,
    actors: 4,
    history: 2,
    path: 10
  },
  {
    name: 'source-only',
    characters: 6,
    scenes: 12,
    foreignStates: 0,
    actors: 20,
    history: 20,
    path: 200
  },
  {
    name: 'states-deep',
    characters: 6,
    scenes: 12,
    foreignStates: 10,
    actors: 20,
    history: 20,
    path: 200
  },
  {
    name: 'combined-source-only',
    characters: 100,
    scenes: 100,
    foreignStates: 0,
    actors: 20,
    history: 20,
    path: 200
  },
  {
    name: 'combined',
    characters: 100,
    scenes: 100,
    foreignStates: 50,
    actors: 20,
    history: 20,
    path: 200
  }
] as const
export type HistoryCase = (typeof historyCases)[number]

export function seedHistoryFixture(root: string, size: HistoryCase) {
  const campaigns = new CampaignStore(root)
  try {
    campaigns.create('History measurement')
    const db = activeCampaignDatabase(campaigns)
    const play = new LivePlayService(campaigns.activeCampaignPersistence())
    const sourceId = play.readSession().scene.focusedSceneId
    const sceneIds = [sourceId]
    const party = new PartyStore(db)
    db.transaction(() => {
      for (let i = 0; i < size.characters; i++)
        party.create(
          {
            name: `Character ${i}`,
            playerName: `Player ${i}`,
            level: 5,
            armorClass: 16,
            passivePerception: 12,
            languages: ['Common', 'Elvish']
          },
          party.read().revision
        )
      const ids = party.read().members.map((member) => member.id)
      for (const id of ids.slice(0, 4))
        play.setMembership(id, true, party.read().revision)
      db.prepare(
        'UPDATE player_characters SET xp_since_short_rest = 700, xp_since_long_rest = 700'
      ).run()
      for (let i = 1; i < size.scenes; i++) {
        const id = randomUUID()
        sceneIds.push(id)
        db.prepare(
          'INSERT INTO scene_running_scene (id,title,location_name,game_time_seconds,position) VALUES (?,?,?,?,?)'
        ).run(id, `Scene ${i}`, 'Measurement location', 90000, i)
      }
      if (size.actors === 0) return
      const scene = new SceneStore(db, () => [])
      const addGroup = (sceneId: string) => {
        scene.saveGroup(
          sceneId,
          null,
          'Wolves',
          '',
          'hostile',
          [{ creatureId: 'wolf', quantity: size.actors }],
          scene.revision(),
          null
        )
        return scene
          .snapshot(party.read().members)
          .scenes.find((entry) => entry.id === sceneId)!.groups[0]!
      }
      const sourceGroup = addGroup(sourceId)
      play.prepareCombat(sourceId, scene.revision(), [sourceGroup.id])
      const combat = play.readSession().combat!
      play.confirmInitiative(
        combat.revision,
        combat.initiativeRows.map((row) => ({ id: row.id, initiative: 12 }))
      )
      const repository = (id: string) =>
        new CombatRepository(db, id, scene, party)
      const template = repository(sourceId).load()!
      const monster = template.combatants.find(
        (member) => !member.playerCharacter
      )!
      const maps = new HexMapStore(db, new WorldLocationStore(db))
      const map = maps.create({
        displayName: 'Measurement path',
        expectedCatalogRevision: maps.catalog().revision
      })
      maps.applyBrushTargets({
        mapId: map.id,
        mode: 'paint',
        biomeId: 'grassland',
        coordinates: Array.from({ length: size.path }, (_, q) => ({ q, r: 0 })),
        expectedContentRevision: map.contentRevision
      })
      for (const [index, sceneId] of [
        sourceId,
        ...sceneIds.slice(1, size.foreignStates + 1)
      ].entries()) {
        const repo = repository(sceneId)
        if (index > 0) {
          const group = addGroup(sceneId)
          const entry = group.entries[0]!
          const sources = entry.members.map((member, i) => ({
            kind: 'monster' as const,
            rowId: `monster:${member.id}`,
            sourceEntryId: entry.id,
            partitionKind: 'individual' as const,
            displayOrdinal: i + 1,
            groupId: group.id,
            creatureId: 'wolf',
            name: 'Wolf',
            quantity: 1,
            memberIds: [member.id],
            initiative: 12
          }))
          // A persisted combat can retain its enemies after the party has left.
          repo.save({
            ...template,
            id: randomUUID(),
            selectedGroupIds: [group.id],
            sources,
            combatants: entry.members.map((member, i) => ({
              ...monster,
              id: member.id,
              sceneMemberId: member.id,
              cardId: sources[i]!.rowId,
              order: i
            })),
            turnOrder: sources.map((row) => row.rowId),
            activeIndex: 0
          })
        }
        const state = repo.load()!
        for (let i = 0; i < size.history; i++)
          repo.recordHistory(
            'Measured member state',
            {
              kind: 'member-states',
              states: state.combatants.map((member) => ({
                id: member.id,
                currentHp: member.currentHp,
                conditions: [],
                concentrating: false,
                exhaustionLevel: 0
              }))
            },
            i
          )
        db.prepare(
          'INSERT INTO hex_journey (scene_id,revision,map_id,status,current_index,party_member_ids_json,multiplier,segment_started_at,abort_reason,hint_code) VALUES (?,1,?,?,0,?,1,1,NULL,?)'
        ).run(
          sceneId,
          map.id,
          index === 0 ? 'travelling' : 'paused',
          JSON.stringify(index === 0 ? ids.slice(0, 4) : []),
          index === 0 ? 'travelling' : 'membershipChanged'
        )
        for (let position = 0; position < size.path; position++)
          db.prepare(
            'INSERT INTO hex_journey_path (scene_id,position,map_id,q,r) VALUES (?,?,?,?,0)'
          ).run(sceneId, position, map.id, position)
      }
    })()
    return {
      campaignId: campaigns.activeCampaignId(),
      sourceId,
      memberId: party.read().members[0]!.id
    }
  } finally {
    campaigns.close()
  }
}
