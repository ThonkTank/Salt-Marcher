import { HexMapStore } from '../src/core/hex/hex-map-store.js'
import { HexTravelService } from '../src/core/hex/hex-travel.js'
import { WorldLocationStore } from '../src/core/worldplanner/location-store.js'
import { WorldLocationService } from '../src/core/worldplanner/location-store.js'
import { SceneStore } from '../src/core/scene/scene-store.js'
import { randomUUID } from 'node:crypto'
import { CampaignStore } from '../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../src/core/encounter/live-combat.js'

/** Isolated pre-launch fixture preparation; never touches the installed profile. */
export function materializeSceneDesktopFixture(
  dataRoot: string,
  extendedRoster = false
): void {
  const campaigns = new CampaignStore(dataRoot)
  try {
    campaigns.create('Desktop Acceptance')
    const persistence = campaigns.activeCampaignPersistence()
    const locations = new WorldLocationService(persistence)
    const harbor = locations
      .create(
        {
          displayName: 'Salzmarschhafen',
          tags: ['Ort'],
          notes:
            'Am Hafen werden Longsword und andere Waren gehandelt.\n\n' +
            Array.from(
              { length: 100 },
              (_, index) =>
                `Kai ${index + 1}: Speicher, Anlegestellen und schmale Gassen liegen zwischen den Lagerhäusern.`
            ).join('\n\n')
        },
        locations.read().revision
      )
      .snapshot.locations.find(
        (location) => location.displayName === 'Salzmarschhafen'
      )!
    const forest = locations
      .create(
        {
          displayName: 'Düsterwald',
          tags: ['Ort'],
          notes: 'Ein alter Pfad führt durch den Wald.'
        },
        locations.read().revision
      )
      .snapshot.locations.find(
        (location) => location.displayName === 'Düsterwald'
      )!
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
    persistence.use((db) => {
      db.prepare(
        'UPDATE scene_running_scene SET location_id = ? WHERE id = ?'
      ).run(harbor.id, firstId)
      db.prepare(
        'UPDATE scene_running_scene SET location_id = ? WHERE id = ?'
      ).run(forest.id, secondId)
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
          languages: extendedRoster
            ? ['Common', index === 0 ? 'Abyssal' : 'Elvish']
            : [],
          passivePerception: extendedRoster ? 14 : null,
          passiveInsight: null,
          passiveInvestigation: null,
          armorClass: null,
          movementSpeedFeet: 30
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
          'hostile',
          [{ creatureId: 'wolf', quantity: 2 }],
          scenes.revision(),
          null
        )
      })
    }
    if (extendedRoster) {
      for (let index = 0; index < 16; index++) {
        let party = play.readParty()
        party = play.createPartyCharacter(
          {
            name:
              index < 2
                ? 'Edrik'
                : index === 2
                  ? 'Zuga'
                  : `Reserve ${index + 1}`,
            playerName: index === 0 ? 'Alex' : index === 1 ? 'Mara' : null,
            level: index === 2 ? 3 : null,
            passivePerception: null,
            passiveInsight: index === 2 ? 16 : null,
            armorClass: null,
            languages: index === 2 ? ['Common', 'Abyssal'] : []
          },
          party.revision
        )
        if (index === 2)
          play.setMembership(party.members.at(-1)!.id, true, party.revision)
      }
    }
    const mapId = persistence.use((db) => {
      const maps = new HexMapStore(db, new WorldLocationStore(db))
      const map = maps.create({
        displayName: 'Küstenweg',
        expectedCatalogRevision: maps.catalog().revision
      })
      maps.applyBrushTargets({
        mapId: map.id,
        mode: 'paint',
        biomeId: 'grassland',
        coordinates: Array.from({ length: 12 }, (_, q) => ({ q, r: 0 })),
        expectedContentRevision: map.contentRevision
      })
      return map.id
    })
    const travel = new HexTravelService(persistence)
    for (const [index, sceneId] of [firstId, secondId].entries()) {
      travel.position({
        sceneId,
        mapId,
        coordinate: { q: index * 2, r: 0 },
        expectedSceneRevision: play.readSession().scene.revision
      })
    }
    // Keep the named locations used by reference and overview acceptance cases.
    persistence.use((db) => {
      db.prepare(
        'UPDATE scene_running_scene SET location_id = ?, location_name = ? WHERE id = ?'
      ).run(harbor.id, harbor.displayName, firstId)
      db.prepare(
        'UPDATE scene_running_scene SET location_id = ?, location_name = ? WHERE id = ?'
      ).run(forest.id, forest.displayName, secondId)
    })
  } finally {
    campaigns.close()
  }
}
