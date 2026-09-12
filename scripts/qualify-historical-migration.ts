import { expectedHistoricalMigrationProfile } from './qualification/historical-profile-expectations.js'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import {
  copyHistoricalWorkingProfile,
  readHistoricalArtifact,
  runHistoricalArtifact
} from './qualification/historical-artifact-runner.js'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    target: { type: 'string' },
    'source-home': { type: 'string' },
    'target-home': { type: 'string' },
    'continuation-home': { type: 'string' }
  }
})
const sourceDirectory = z.string().min(1).parse(values.source)
const targetDirectory = z.string().min(1).parse(values.target)
const sourceHome = resolve(z.string().min(1).parse(values['source-home']))
const targetHome = resolve(z.string().min(1).parse(values['target-home']))
const sourceArtifact = readHistoricalArtifact(sourceDirectory)
const targetArtifact = readHistoricalArtifact(targetDirectory)
const source = await runHistoricalArtifact(sourceDirectory, sourceHome, 'read')
assert(source.result.response.ok, 'Source must be readable by its own runtime')
const before = source.result.response.result
copyHistoricalWorkingProfile(sourceHome, targetHome)
const incompatibleRead = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'read'
)
const schemaChange =
  JSON.stringify(sourceArtifact.receipt.source.schemaVersions) !==
  JSON.stringify(targetArtifact.receipt.source.schemaVersions)
assert.equal(
  incompatibleRead.result.response.ok,
  !schemaChange,
  'Target read must not silently migrate old formats'
)
const migration = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'migrate'
)
assert(migration.result.response.ok, JSON.stringify(migration.result.response))
const migrated = z
  .object({
    transitions: z.array(
      z
        .object({
          path: z.string(),
          role: z.enum(['installation', 'campaign']),
          fromVersion: z.number().int(),
          toVersion: z.number().int(),
          migrations: z.array(z.string())
        })
        .strict()
    ),
    profile: z.unknown()
  })
  .strict()
  .parse(migration.result.response.result)
const expected = expectedHistoricalMigrationProfile(
  before,
  sourceArtifact.receipt.source.schemaVersions,
  targetArtifact.receipt.source.schemaVersions
)
assert.deepStrictEqual(
  migrated.profile,
  expected,
  'Migration must preserve all fixture values'
)
for (const transition of migrated.transitions) {
  assert.equal(
    transition.fromVersion,
    sourceArtifact.receipt.source.schemaVersions[transition.role]
  )
  assert.equal(
    transition.toVersion,
    targetArtifact.receipt.source.schemaVersions[transition.role]
  )
}
assert.equal(
  migrated.transitions.some(({ migrations }) => migrations.length > 0),
  schemaChange
)
const reopened = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'read'
)
assert(reopened.result.response.ok)
assert.deepStrictEqual(reopened.result.response.result, expected)
const advanced = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'advance-combat'
)
assert(advanced.result.response.ok)
const partyView = z.object({
  coverage: z.literal(
    'settings-campaigns-party-own-files-world-combat-travel-v3'
  ),
  registry: z.object({ activeCampaignId: z.uuid() }),
  campaigns: z.array(
    z.object({
      id: z.uuid(),
      party: z.object({
        members: z.array(z.object({ id: z.uuid(), xp: z.number() }))
      }),
      world: z.object({
        tables: z.object({
          tables: z.array(z.object({ id: z.uuid() })).min(1)
        }),
        factions: z.object({
          factions: z
            .array(
              z.object({ id: z.uuid(), primaryEncounterTableId: z.uuid() })
            )
            .min(1)
        }),
        locations: z.object({
          locations: z
            .array(
              z.object({
                id: z.uuid(),
                factionIds: z.array(z.uuid()),
                encounterTableIds: z.array(z.uuid())
              })
            )
            .min(1)
        }),
        npcs: z.object({
          npcs: z
            .array(
              z.object({
                id: z.uuid(),
                factionId: z.uuid(),
                locationId: z.uuid(),
                notes: z.literal('Aus der Flussuferhöhle gerettet.')
              })
            )
            .min(1)
        })
      }),
      travel: z.object({
        journey: z.object({
          status: z.literal('paused'),
          mapId: z.uuid(),
          current: z.object({ q: z.number().int(), r: z.number().int() }),
          currentIndex: z.number().int(),
          gameTimeSeconds: z.number(),
          path: z
            .array(z.object({ q: z.number().int(), r: z.number().int() }))
            .length(5)
        })
      }),
      game: z.object({
        locations: z.object({
          locations: z
            .array(z.object({ displayName: z.string(), notes: z.string() }))
            .min(1)
        }),
        session: z.object({
          combat: z.object({
            phase: z.literal('combat'),
            revision: z.number().int(),
            round: z.number().int(),
            cards: z
              .array(
                z.object({
                  id: z.string(),
                  active: z.boolean(),
                  playerCharacter: z.boolean(),
                  currentHp: z.number(),
                  maxHp: z.number(),
                  conditions: z.array(z.string())
                })
              )
              .min(2)
          })
        })
      })
    })
  )
})
const previousParty = partyView.parse(before)
const nextParty = partyView.parse(advanced.result.response.result)
for (const campaign of previousParty.campaigns) {
  const after = nextParty.campaigns.find(({ id }) => id === campaign.id)
  assert(after)
  const world = campaign.world
  const npc = world.npcs.npcs[0]!
  const faction = world.factions.factions.find(({ id }) => id === npc.factionId)
  const location = world.locations.locations.find(
    ({ id }) => id === npc.locationId
  )
  assert(faction && location)
  assert(
    world.tables.tables.some(({ id }) => id === faction.primaryEncounterTableId)
  )
  assert(location.factionIds.includes(faction.id))
  assert(location.encounterTableIds.includes(faction.primaryEncounterTableId))
  const journey = campaign.travel.journey
  assert(
    journey.currentIndex >= 1 && journey.currentIndex < journey.path.length - 1
  )
  assert.deepStrictEqual(journey.current, journey.path[journey.currentIndex])
  assert(
    campaign.game.locations.locations.some(
      ({ notes }) => notes === 'Die alte Fähre ist noch benutzbar.'
    )
  )
  assert(
    campaign.game.session.combat.cards.some(
      (card) =>
        !card.playerCharacter &&
        card.conditions.includes('poisoned') &&
        card.currentHp < card.maxHp
    )
  )
  if (campaign.id === previousParty.registry.activeCampaignId) {
    assert.deepStrictEqual(after.world, campaign.world)
    assert.deepStrictEqual(after.travel, campaign.travel)
    assert.equal(after.party.members[0]!.id, campaign.party.members[0]!.id)
    assert.equal(after.party.members[0]!.xp, campaign.party.members[0]!.xp + 25)
    assert(
      after.game.session.combat.revision > campaign.game.session.combat.revision
    )
    assert.notDeepStrictEqual(
      {
        round: after.game.session.combat.round,
        active: after.game.session.combat.cards.find((card) => card.active)?.id
      },
      {
        round: campaign.game.session.combat.round,
        active: campaign.game.session.combat.cards.find((card) => card.active)
          ?.id
      }
    )
  } else assert.deepStrictEqual(after, campaign)
}
const persisted = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'read'
)
assert(persisted.result.response.ok)
assert.deepStrictEqual(
  persisted.result.response.result,
  advanced.result.response.result
)
let continuation: Awaited<ReturnType<typeof runHistoricalArtifact>> | undefined
if (values['continuation-home']) {
  const continuationHome = resolve(values['continuation-home'])
  copyHistoricalWorkingProfile(targetHome, continuationHome)
  continuation = await runHistoricalArtifact(
    targetDirectory,
    continuationHome,
    'read'
  )
  assert(continuation.result.response.ok)
  assert.deepStrictEqual(
    continuation.result.response.result,
    persisted.result.response.result
  )
}
const travelled = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'finish-combat-and-travel'
)
assert(travelled.result.response.ok, JSON.stringify(travelled.result.response))
const finalView = partyView.extend({
  campaigns: z.array(
    partyView.shape.campaigns.element
      .extend({
        game: partyView.shape.campaigns.element.shape.game.extend({
          session: z.object({ combat: z.null() })
        })
      })
      .or(partyView.shape.campaigns.element)
  )
})
const envelope = z
  .object({ campaigns: z.array(z.object({ id: z.uuid() }).passthrough()) })
  .passthrough()
const { campaigns: priorCampaigns, ...priorEnvelope } = envelope.parse(
  advanced.result.response.result
)
const { campaigns: finalCampaigns, ...finalEnvelope } = envelope.parse(
  travelled.result.response.result
)
assert.deepStrictEqual(
  finalEnvelope,
  priorEnvelope,
  'Journey continuation must preserve settings, registry and own files'
)
for (const campaign of priorCampaigns) {
  if (campaign.id !== nextParty.registry.activeCampaignId)
    assert.deepStrictEqual(
      finalCampaigns.find(({ id }) => id === campaign.id),
      campaign
    )
}
const finalProfile = finalView.parse(travelled.result.response.result)
for (const prior of nextParty.campaigns) {
  const final = finalProfile.campaigns.find(({ id }) => id === prior.id)
  assert(final)
  if (prior.id !== nextParty.registry.activeCampaignId) {
    assert.deepStrictEqual(final, prior)
    continue
  }
  assert.equal(final.game.session.combat, null)
  assert.deepStrictEqual(final.world, prior.world)
  assert.deepStrictEqual(final.party, prior.party)
  const journey = prior.travel.journey
  assert.equal(final.travel.journey.currentIndex, journey.currentIndex + 1)
  assert.equal(
    final.travel.journey.gameTimeSeconds,
    journey.gameTimeSeconds + 3600
  )
  assert.equal(final.travel.journey.mapId, journey.mapId)
  assert.deepStrictEqual(final.travel.journey.path, journey.path)
  assert.deepStrictEqual(
    final.travel.journey.current,
    journey.path[journey.currentIndex + 1]
  )
}
const travelledPersisted = await runHistoricalArtifact(
  targetDirectory,
  targetHome,
  'read'
)
assert(travelledPersisted.result.response.ok)
assert.deepStrictEqual(
  travelledPersisted.result.response.result,
  travelled.result.response.result
)
const sourceAfter = await runHistoricalArtifact(
  sourceDirectory,
  sourceHome,
  'read'
)
assert(sourceAfter.result.response.ok)
assert.deepStrictEqual(
  sourceAfter.result.response.result,
  before,
  'Source profile must remain unchanged'
)
writeFileSync(
  join(targetHome, 'historical-migration-evidence.json'),
  JSON.stringify(
    {
      formatVersion: 1,
      coverage: 'historical-schema-and-partial-profile-not-update-activation',
      source,
      incompatibleRead,
      migration,
      reopened,
      advanced,
      persisted,
      continuation,
      travelled,
      travelledPersisted,
      sourceAfter
    },
    null,
    2
  ),
  { flag: 'wx' }
)
console.info(
  JSON.stringify({
    event: 'historical-migration-passed',
    sourceSha256: sourceArtifact.receipt.artifact.sha256,
    targetSha256: targetArtifact.receipt.artifact.sha256,
    transitions: migrated.transitions,
    evidence: join(targetHome, 'historical-migration-evidence.json')
  })
)
