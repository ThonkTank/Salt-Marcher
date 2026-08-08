import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { CampaignStore } from '../src/core/persistence/sqlite/campaign-store.js'
import { WorldLocationService } from '../src/core/worldplanner/location-store.js'
import { SceneStore } from '../src/core/scene/scene-store.js'
import { sessionLayoutPreferenceSchema } from '../src/shared/contracts/session-layout.js'

const fixtureSchema = z
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
