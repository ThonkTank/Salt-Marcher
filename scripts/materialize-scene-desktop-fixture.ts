import { SceneStore } from '../src/core/scene/scene-store.js'
import { randomUUID } from 'node:crypto'
import { CampaignStore } from '../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../src/core/encounter/live-combat.js'

/** Isolated pre-launch fixture preparation; never touches the installed profile. */
export function materializeSceneDesktopFixture(dataRoot: string): void {
  const campaigns = new CampaignStore(dataRoot)
  try {
    campaigns.create('Desktop Acceptance')
    const persistence = campaigns.activeCampaignPersistence()
    const play = new LivePlayService(persistence)
    const firstId = play.readSession().scene.focusedSceneId
    const secondId = randomUUID()
    persistence.use((db) => {
      db.prepare(
        'UPDATE scene_running_scene SET title = ?, location_name = ? WHERE id = ?'
      ).run('Hafen', 'Salzmarschhafen', firstId)
      db.prepare(
        'INSERT INTO scene_running_scene (id, title, location_name, game_time_seconds, position) VALUES (?, ?, ?, ?, 1)'
      ).run(secondId, 'Wald', 'Düsterwald', 90000)
    })
    for (const [index, sceneId] of [firstId, secondId].entries()) {
      let party = play.readParty()
      const name = index === 0 ? 'Edrik' : 'Vivian'
      party = play.createPartyCharacter(
        {
          name,
          playerName: index === 0 ? 'Alex' : 'Sam',
          level: 3,
          species: null,
          characterClass: null,
          languages: [],
          passivePerception: null,
          passiveInsight: null,
          passiveInvestigation: null,
          armorClass: null,
          movementSpeedFeet: null
        },
        party.revision
      )
      const member = party.members.find((entry) => entry.name === name)!
      party = play.setMembership(member.id, true, party.revision)
      persistence.use((db) => {
        db.prepare(
          'UPDATE scene_party_member SET scene_id = ? WHERE party_member_id = ?'
        ).run(sceneId, member.id)
        const scenes = new SceneStore(db, () => [])
        scenes.saveGroup(
          sceneId,
          null,
          index === 0 ? 'Hafenwache' : 'Wanderer',
          '',
          'neutral',
          [],
          scenes.revision(),
          null
        )
      })
    }
  } finally {
    campaigns.close()
  }
}
