import { seedHistoricalWorld, readHistoricalWorld } from './world-profile.js'
import {
  seedHistoricalTravel,
  readHistoricalTravel,
  advanceHistoricalTravel
} from './travel-profile.js'
import { CampaignStore } from '@historical/campaign-store'
import { PartyStore } from '@historical/party-store'
import { preflightPersistence } from '@historical/preflight'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { migrateHistoricalProfileData } from './migrate-profile.js'
import {
  advanceHistoricalCombat,
  finishHistoricalCombat,
  readHistoricalCombat,
  seedHistoricalCombat
} from './combat-profile.js'

const campaignNames = [
  'Salzmarsch – aktiv',
  'Winterlager – inaktiv',
  'Alte Küste – gelöscht'
] as const

export function seedHistoricalProfile(profile: string) {
  if (existsSync(profile))
    throw new Error('Historical seed requires a new profile')
  const store = new CampaignStore(join(profile, 'campaign-data'))
  try {
    const ids = campaignNames.map((name, index) => {
      const id = store.create(name).activeCampaignId
      if (!id)
        throw new Error(
          'Historical campaign creation did not select a campaign'
        )
      store.visitCampaignDatabase(id, (database) => {
        const party = new PartyStore(database)
        const created = party.create(
          {
            name: `Mara ${index + 1}`,
            playerName: 'Abnahme',
            species: 'Mensch',
            characterClass: 'Waldläufer',
            languages: ['Gemeinsprache', 'Elfisch'],
            level: 3,
            passivePerception: 14,
            passiveInvestigation: 12,
            passiveInsight: 13,
            armorClass: 16,
            movementSpeedFeet: 30
          },
          party.read().revision
        )
        const member = created.members[0]!
        const active = party.setMembership(member.id, true, created.revision)
        party.adjustXp(member.id, 75 + index, active.revision)
        const locationId = seedHistoricalWorld(database, index)
        seedHistoricalTravel(database, locationId)
        seedHistoricalCombat(database)
      })
      return id
    })
    store.trash(ids[2]!)
    store.activate(ids[0]!)
    store.updateSettings({ theme: 'dark' }, store.readSettings().revision)
  } finally {
    store.close()
  }
  const own = join(profile, 'own-content')
  mkdirSync(join(own, 'empty-directory'), { recursive: true })
  writeFileSync(
    join(own, 'Küstenchronik.txt'),
    'Salz, Sturm und spätere Entscheidungen.\n'
  )
  writeFileSync(join(own, 'map.bin'), Buffer.from([0, 255, 17, 128, 42]))
  writeFileSync(
    join(profile, 'preferences.json'),
    JSON.stringify({ panel: 'notes', scale: 1.25 })
  )
  return readHistoricalProfile(profile)
}

function readyStore(profile: string) {
  const data = join(profile, 'campaign-data')
  if (preflightPersistence(data).kind !== 'ready')
    throw new Error(
      'Historical readback requires the exact target schema before opening'
    )
  return new CampaignStore(data)
}

export function readHistoricalProfile(profile: string) {
  const store = readyStore(profile)
  try {
    const registry = store.list()
    const campaigns = store
      .visitCampaignDatabases(({ id, name, trashed, database }) => ({
        id,
        name,
        trashed,
        party: new PartyStore(database).read(),
        game: readHistoricalCombat(database),
        world: readHistoricalWorld(database),
        travel: readHistoricalTravel(database)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return {
      coverage: 'settings-campaigns-party-own-files-world-combat-travel-v3',
      settings: store.readSettings(),
      registry: {
        activeCampaignId: registry.activeCampaignId,
        campaigns: registry.campaigns,
        trashedCampaigns: registry.trashedCampaigns
      },
      campaigns,
      preferences: readFileSync(join(profile, 'preferences.json'), 'utf8'),
      ownFiles: ownFiles(join(profile, 'own-content'))
    }
  } finally {
    store.close()
  }
}

function ownFiles(
  directory: string,
  prefix = ''
): { path: string; kind: 'file' | 'directory'; base64?: string }[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = prefix + entry.name
      if (entry.isDirectory())
        return [
          { path, kind: 'directory' as const },
          ...ownFiles(join(directory, entry.name), `${path}/`)
        ]
      if (!entry.isFile())
        throw new Error('Unexpected own-content filesystem entry')
      return [
        {
          path,
          kind: 'file' as const,
          base64: readFileSync(join(directory, entry.name)).toString('base64')
        }
      ]
    })
}

export function advanceHistoricalProfile(
  profile: string,
  includeTravel = true
) {
  const store = readyStore(profile)
  try {
    store.visitCampaignDatabase(store.activeCampaignId(), (database) => {
      const party = new PartyStore(database)
      const current = party.read()
      party.adjustXp(current.members[0]!.id, 25, current.revision)
      advanceHistoricalCombat(database)
      if (includeTravel) advanceHistoricalTravel(database)
    })
  } finally {
    store.close()
  }
  writeFileSync(
    join(profile, 'own-content', 'later-work.txt'),
    'Weitergearbeitet nach dem Update.\n'
  )
  return readHistoricalProfile(profile)
}

export function migrateHistoricalProfile(profile: string) {
  return migrateHistoricalProfileData(profile, readHistoricalProfile)
}

export function finishCombatAndTravelHistoricalProfile(profile: string) {
  const store = readyStore(profile)
  try {
    store.visitCampaignDatabase(store.activeCampaignId(), (database) => {
      finishHistoricalCombat(database)
      advanceHistoricalTravel(database)
    })
  } finally {
    store.close()
  }
  return readHistoricalProfile(profile)
}
