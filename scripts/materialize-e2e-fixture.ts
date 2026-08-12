import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { CampaignStore } from '../src/core/persistence/sqlite/campaign-store.js'
import { WorldLocationService } from '../src/core/worldplanner/location-store.js'
import { SceneStore } from '../src/core/scene/scene-store.js'
import { sessionLayoutPreferenceSchema } from '../src/shared/contracts/session-layout.js'
import { LivePlayService } from '../src/core/encounter/live-combat.js'
import { HexMapStore } from '../src/core/hex/hex-map-store.js'
import { HexTravelService } from '../src/core/hex/hex-travel.js'
import { WorldLocationStore } from '../src/core/worldplanner/location-store.js'
import { hexBiomeIdSchema } from '../src/shared/contracts/hex.js'

const fixtureV1Schema = z
  .object({
    version: z.literal(1),
    campaign: z.string().min(1).nullable(),
    sessionLayout: sessionLayoutPreferenceSchema.optional(),
    locations: z.array(
      z
        .object({
          displayName: z.string().min(1),
          tags: z.array(z.string()),
          readAloud: z.string(),
          notes: z.string()
        })
        .strict()
    ),
    sceneLocation: z.string().min(1).nullable()
  })
  .strict()

const fixtureV2Schema = fixtureV1Schema
  .omit({ version: true })
  .extend({
    version: z.literal(2),
    party: z.array(
      z
        .object({
          name: z.string().min(1),
          active: z.boolean(),
          movementSpeedFeet: z.number().int().positive().nullable()
        })
        .strict()
    ),
    travelScenario: z
      .object({
        mapName: z.string().min(1),
        tiles: z.array(
          z
            .object({
              q: z.number().int(),
              r: z.number().int(),
              biomeId: hexBiomeIdSchema
            })
            .strict()
        ),
        locationName: z.string().min(1),
        locationCoordinate: z
          .object({ q: z.number().int(), r: z.number().int() })
          .strict(),
        partyCoordinate: z
          .object({ q: z.number().int(), r: z.number().int() })
          .strict()
      })
      .strict()
  })
  .strict()

const fixtureSchema = z.discriminatedUnion('version', [
  fixtureV1Schema,
  fixtureV2Schema
])

const userData = requiredArgument('--user-data')
const fixturePath = resolve(userData, 'fixture.json')
const fixture = fixtureSchema.parse(
  JSON.parse(readFileSync(fixturePath, 'utf8'))
)
const campaigns = new CampaignStore(resolve(userData, 'development-data'))
try {
  if (fixture.campaign === null) process.exitCode = 0
  else {
    campaigns.create(fixture.campaign)
    if (fixture.sessionLayout)
      campaigns.updateSettings(
        { sessionLayout: fixture.sessionLayout },
        campaigns.readSettings().revision
      )
    const locations = new WorldLocationService(() =>
      campaigns.activeCampaignDatabase()
    )
    let snapshot = locations.read()
    for (const input of fixture.locations)
      snapshot = locations.create(
        {
          ...input,
          factionIds: [],
          encounterTableIds: []
        },
        snapshot.revision
      ).snapshot
    if (fixture.version === 2) {
      const database = () => campaigns.activeCampaignDatabase()
      const play = new LivePlayService(database)
      let party = play.readParty()
      for (const configured of fixture.party) {
        const member = party.members.find(
          (candidate) => candidate.name === configured.name
        )
        if (!member)
          throw new Error(`Fixture party member is missing: ${configured.name}`)
        party = play.updatePartyCharacter(
          member.id,
          {
            name: member.name,
            playerName: member.playerName,
            level: member.level,
            passivePerception: member.passivePerception,
            armorClass: member.armorClass,
            movementSpeedFeet: configured.movementSpeedFeet
          },
          party.revision
        )
        const updated = party.members.find(
          (candidate) => candidate.id === member.id
        )!
        if (updated.active !== configured.active)
          party = play.setMembership(
            member.id,
            configured.active,
            party.revision
          )
      }
      const location = snapshot.locations.find(
        (candidate) =>
          candidate.displayName === fixture.travelScenario.locationName
      )
      if (!location)
        throw new Error(
          `Fixture travel location is missing: ${fixture.travelScenario.locationName}`
        )
      const db = database()
      const mapStore = new HexMapStore(db, new WorldLocationStore(db))
      let map = mapStore.create({
        displayName: fixture.travelScenario.mapName,
        expectedCatalogRevision: mapStore.catalog().revision
      })
      const byBiome = Map.groupBy(
        fixture.travelScenario.tiles,
        (tile) => tile.biomeId
      )
      for (const [biomeId, tiles] of byBiome) {
        map = mapStore.applyBrushTargets({
          mapId: map.id,
          mode: 'paint',
          biomeId,
          coordinates: tiles,
          expectedContentRevision: map.contentRevision
        }).map
      }
      map = mapStore.placeLocation({
        mapId: map.id,
        locationId: location.id,
        coordinate: fixture.travelScenario.locationCoordinate,
        expectedContentRevision: map.contentRevision
      }).map
      const session = play.readSession()
      new HexTravelService(database).position({
        sceneId: session.scene.focusedSceneId,
        mapId: map.id,
        coordinate: fixture.travelScenario.partyCoordinate,
        expectedSceneRevision: session.scene.revision
      })
    }
    if (fixture.sceneLocation !== null) {
      const location = snapshot.locations.find(
        (candidate) => candidate.displayName === fixture.sceneLocation
      )
      if (!location)
        throw new Error(
          `Fixture scene location is missing: ${fixture.sceneLocation}`
        )
      const scenes = new SceneStore(
        campaigns.activeCampaignDatabase(),
        () => locations.read().locations
      )
      scenes.setLocation(
        scenes.focusedSceneId(),
        location.id,
        scenes.revision()
      )
    }
  }
} finally {
  campaigns.close()
}

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = process.argv[index + 1]
  if (index < 0 || !value) throw new Error(`${name} is required`)
  return value
}
