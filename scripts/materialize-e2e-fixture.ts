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
import { CampaignRulesService } from '../src/core/application/campaign-rules-service.js'
import { BundledSessionGenerationCatalogRegistry } from '../src/utility/session-generation/catalog-provider.js'
import { SessionGenerationService } from '../src/utility/session-generation/session-generation-service.js'
import { sha256EncounterEntropy } from '../src/utility/session-generation/sha256-entropy.js'
import { defaultGeneratorConfig } from '../src/shared/generator/system-generator-preset.js'
import { systemGeneratorPresetId } from '../src/shared/contracts/generator-presets.js'
import { TreasureStore } from '../src/core/loot/loot-store.js'

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

const partyFixtureSchema = z.array(
  z
    .object({
      name: z.string().min(1),
      active: z.boolean(),
      movementSpeedFeet: z.number().int().positive().nullable()
    })
    .strict()
)

const fixtureV2Schema = fixtureV1Schema
  .omit({ version: true })
  .extend({
    version: z.literal(2),
    party: partyFixtureSchema,
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

const fixtureV3Schema = fixtureV1Schema
  .omit({ version: true })
  .extend({
    version: z.literal(3),
    party: partyFixtureSchema,
    groupScenario: z
      .object({
        name: z.string().min(1),
        creatureId: z.string().min(1),
        quantity: z.number().int().positive()
      })
      .strict()
  })
  .strict()

const fixtureV4Schema = fixtureV3Schema
  .omit({ version: true })
  .extend({
    version: z.literal(4),
    lootScenario: z
      .object({
        label: z.string().min(1),
        seed: z.number().int().nonnegative().safe()
      })
      .strict()
  })
  .strict()

const fixtureSchema = z.discriminatedUnion('version', [
  fixtureV1Schema,
  fixtureV2Schema,
  fixtureV3Schema,
  fixtureV4Schema
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
    if (
      fixture.version === 2 ||
      fixture.version === 3 ||
      fixture.version === 4
    ) {
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
      let live = play.readSession()
      const focusedSceneId = live.scene.focusedSceneId
      for (const member of party.members.filter(
        (candidate) => candidate.active
      )) {
        const scene = live.scene.scenes.find(
          (candidate) => candidate.id === focusedSceneId
        )!
        if (!scene.partyMemberIds.includes(member.id))
          live = play.assignScenePartyMember(
            focusedSceneId,
            member.id,
            true,
            live.scene.revision
          )
      }
      if (fixture.version === 3 || fixture.version === 4) {
        const groupResult = play.saveSceneGroup(
          focusedSceneId,
          null,
          fixture.groupScenario.name,
          '',
          'hostile',
          [
            {
              creatureId: fixture.groupScenario.creatureId,
              quantity: fixture.groupScenario.quantity,
              deadQuantity: 0
            }
          ],
          live.scene.revision,
          null
        )
        if (fixture.version === 4) {
          const snapshot = play.readSession()
          const scene = snapshot.scene.scenes.find(
            (candidate) => candidate.id === focusedSceneId
          )!
          const group = groupResult.scenePatch.upsertedGroups.find(
            (candidate) => candidate.name === fixture.groupScenario.name
          )!
          const groupEntries = group.entries.map((entry) => ({
            creatureId: entry.creatureId,
            quantity: entry.aliveQuantity,
            deadQuantity: entry.deadQuantity
          }))
          const evaluation = play.evaluateGroupDraft(
            scene.id,
            groupEntries,
            snapshot.scene.revision
          )
          const rules = new CampaignRulesService(database).read()
          const generation = new SessionGenerationService(
            new BundledSessionGenerationCatalogRegistry(
              resolve('resources/sessiongeneration')
            ),
            sha256EncounterEntropy,
            () => ({
              id: systemGeneratorPresetId,
              revision: 0,
              config: defaultGeneratorConfig
            }),
            database
          )
          const assignedMembers = party.members.filter(
            (member) =>
              member.active &&
              member.level !== null &&
              scene.partyMemberIds.includes(member.id)
          )
          const rewardXp =
            rules.rewardXpBasis === 'adjusted'
              ? evaluation.adjustedXp
              : evaluation.baseXp
          const run = generation.generateGroupReward({
            party: [
              ...assignedMembers
                .map((member) => member.level!)
                .reduce<Map<number, number>>((counts, level) => {
                  counts.set(level, (counts.get(level) ?? 0) + 1)
                  return counts
                }, new Map())
                .entries()
            ].map(([level, count]) => ({ level, count })),
            ledgerParty: assignedMembers.map((member) => ({
              characterId: member.id,
              level: member.level!,
              currentXp: member.xp,
              ledgerRevision: 0,
              currentNonMagicCp: 0,
              currentMagic: {
                Common: 0,
                Uncommon: 0,
                Rare: 0,
                'Very Rare': 0,
                Legendary: 0
              }
            })),
            sceneId: scene.id,
            groupId: group.id,
            sceneRevision: snapshot.scene.revision,
            groupRevision: group.revision,
            groupEntries,
            partyRevision: party.revision,
            campaignRulesRevision: rules.revision,
            rewardXpBasis: rules.rewardXpBasis,
            baseXp: evaluation.baseXp,
            adjustedXp: evaluation.adjustedXp,
            rewardXp,
            seed: fixture.lootScenario.seed
          })
          const generated = run.treasures[0]!
          const units = generated.items.reduce(
            (total, item) => total + item.quantity,
            0
          )
          if (units < 2)
            throw new Error(
              'Fixture generated reward needs at least two distributable units.'
            )
          new TreasureStore(database()).acceptGenerated(
            run,
            generated,
            fixture.lootScenario.label,
            { kind: 'unplaced' },
            new Date(0).toISOString()
          )
        }
      } else {
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
