import { existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CampaignStore } from '../src/core/persistence/sqlite/campaign-store.js'
import { WorldLocationService } from '../src/core/worldplanner/location-store.js'
import type { WorldLocationDraft } from '../src/shared/contracts/world-location.js'

const seedLocations: readonly WorldLocationDraft[] = [
  {
    displayName: 'Salzmarschhafen',
    tags: ['Hafen', 'Siedlung'],
    readAloud: 'Masten und Möwen zeichnen sich im salzigen Nebel ab.',
    notes: 'Ausgangspunkt der Beispielkampagne.',
    factionIds: [],
    encounterTableIds: []
  },
  {
    displayName: 'Leuchtturmklippe',
    tags: ['Küste', 'Schauplatz'],
    readAloud: 'Gischt schlägt gegen den schwarzen Fels unter dem Leuchtfeuer.',
    notes: 'Gut geeignet, um Ortsplatzierung und Kartenwechsel zu prüfen.',
    factionIds: [],
    encounterTableIds: []
  },
  {
    displayName: 'Versunkene Abtei',
    tags: ['Ruine', 'Insel'],
    readAloud: 'Gebrochene Bögen ragen aus dem flachen Wasser.',
    notes: 'Beispiel für mehrere geordnete Tags.',
    factionIds: [],
    encounterTableIds: []
  }
]

const dataRoot = resolve(
  argument('--data-root') ?? '.tmp/development-data-seed'
)
const force = process.argv.includes('--force')

if (dirname(dataRoot) === dataRoot || dataRoot === resolve(process.cwd()))
  throw new Error(`Refusing unsafe seed target: ${dataRoot}`)

if (existsSync(dataRoot)) {
  if (!force)
    throw new Error(
      `Seed target already exists: ${dataRoot}. Pass --force to recreate this explicit target.`
    )
  rmSync(dataRoot, { recursive: true, force: true })
}

const campaigns = new CampaignStore(dataRoot)
try {
  campaigns.create('Salzmarsch – Beispieldaten')
  const locations = new WorldLocationService(() =>
    campaigns.activeCampaignDatabase()
  )
  let revision = locations.read().revision
  for (const draft of seedLocations) {
    const snapshot = locations.create(draft, revision).snapshot
    revision = snapshot.revision
  }
} finally {
  campaigns.close()
}

console.log(`Schema-20 development data seeded at ${dataRoot}`)

function argument(name: string): string | undefined {
  const prefix = `${name}=`
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length)
}
