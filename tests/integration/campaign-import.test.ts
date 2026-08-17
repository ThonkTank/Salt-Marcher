import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  campaignImportBundleSchema,
  type CampaignImportBundle
} from '../../src/shared/contracts/campaign-import.js'
import {
  CampaignImportService,
  campaignImportExportHash
} from '../../src/core/campaign-import/campaign-import-service.js'
import { creatures } from '../../src/core/creatures/catalog.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { WorldFactionStore } from '../../src/core/worldplanner/faction-store.js'
import { WorldNpcStore } from '../../src/core/worldplanner/npc-store.js'

const roots: string[] = []
const resolver = {
  resolve: (id: string) => {
    const creature = creatures.find((entry) => entry.id === id)
    return creature ? { id: creature.id, displayName: creature.name } : null
  }
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('CampaignImportService', () => {
  it('validates explicit decisions and reports stable source-path conflicts', () => {
    const { service, campaigns } = harness()
    const bundle = fixture()
    expect(service.validate(bundle)).toMatchObject({
      valid: true,
      delta: 'new',
      changedSections: ['party', 'locations', 'factions', 'npcs']
    })

    const invalidDraft = {
      ...structuredClone(bundle),
      source: { ...bundle.source, exportHash: '0'.repeat(64) },
      npcs: bundle.npcs.map((npc, index) =>
        index === 0
          ? {
              ...npc,
              creature: { ...npc.creature, resolvedId: 'not-a-statblock' }
            }
          : npc
      ),
      resolutions: bundle.resolutions.filter(
        (decision) => decision.path !== 'npcs.0.creature'
      )
    }
    const invalid = {
      ...invalidDraft,
      source: {
        ...invalidDraft.source,
        exportHash: campaignImportExportHash(invalidDraft)
      }
    }
    expect(service.preview(invalid).conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_resolution',
          sourcePath: 'npcs.0.creature'
        }),
        expect.objectContaining({
          code: 'unknown_statblock',
          sourcePath: 'npcs.0.creature.resolvedId'
        })
      ])
    )
    campaigns.close()
  })

  it('applies the Tower of Time Golden, persists provenance, and is idempotent', () => {
    const { service, campaigns } = harness()
    const bundle = fixture()
    const first = service.apply(bundle)
    expect(first.status).toBe('applied')
    expect(campaigns.list()).toMatchObject({
      activeCampaignId: first.campaignId,
      campaigns: [{ id: first.campaignId, name: 'Tower of Time' }]
    })
    expect(semanticProjection(campaigns.activeCampaignDatabase())).toEqual(
      JSON.parse(
        readFileSync('tests/golden/campaign-import-tower-of-time.json', 'utf8')
      )
    )
    expect(
      campaigns
        .activeCampaignDatabase()
        .prepare(
          `SELECT source_revision AS revision, export_hash AS exportHash,
                  sections_json AS sectionsJson, resolutions_json AS resolutionsJson
             FROM campaign_import_provenance WHERE source_id = ?`
        )
        .get(bundle.source.id)
    ).toMatchObject({
      revision: 6098,
      exportHash: bundle.source.exportHash,
      sectionsJson: JSON.stringify(bundle.source.sections),
      resolutionsJson: JSON.stringify(bundle.resolutions)
    })

    const second = service.apply(bundle)
    expect(second).toMatchObject({
      status: 'unchanged',
      campaignId: first.campaignId
    })
    expect(campaigns.list().campaigns).toHaveLength(1)
    expect(entityCount(campaigns.activeCampaignDatabase())).toBe(7)
    campaigns.close()
  })

  it('previews and applies a one-fact source delta under the same external identities', () => {
    const { service, campaigns } = harness()
    const initial = fixture()
    const first = service.apply(initial)
    const partyBefore = new PartyStore(campaigns.activeCampaignDatabase())
    const localSnapshot = partyBefore.create(
      {
        name: 'Local-only companion',
        playerName: null,
        species: null,
        characterClass: null,
        languages: [],
        level: null,
        passivePerception: null,
        passiveInvestigation: null,
        passiveInsight: null,
        armorClass: null,
        movementSpeedFeet: null
      },
      partyBefore.read().revision
    )
    const localId = localSnapshot.members.at(-1)!.id
    const beforeHashes = entityHashes(campaigns.activeCampaignDatabase())
    const beforeIds = entityIds(campaigns.activeCampaignDatabase())
    const sourceDelta = JSON.parse(
      readFileSync(
        'tests/fixtures/campaign-import/tower-of-time-6099-delta.json',
        'utf8'
      )
    ) as {
      sourceId: string
      baseRevision: number
      baseExportHash: string
      revision: number
      exportHash: string
      changes: Array<{
        section: string
        externalKey: string
        path: string
        before: number
        after: number
      }>
    }
    expect(sourceDelta).toMatchObject({
      sourceId: initial.source.id,
      baseRevision: initial.source.revision,
      baseExportHash: initial.source.exportHash,
      changes: [
        {
          section: 'party',
          externalKey: 'pc:hank',
          path: 'passivePerception',
          before: 11,
          after: 12
        }
      ]
    })
    const deltaDraft = {
      ...structuredClone(initial),
      source: {
        ...initial.source,
        revision: sourceDelta.revision,
        exportHash: '0'.repeat(64)
      },
      party: initial.party.map((member, index) =>
        index === 0
          ? {
              ...member,
              passivePerception: sourceDelta.changes[0]!.after
            }
          : member
      )
    }
    const delta = {
      ...deltaDraft,
      source: {
        ...deltaDraft.source,
        exportHash: campaignImportExportHash(deltaDraft)
      }
    }
    expect(delta.source.exportHash).toBe(sourceDelta.exportHash)

    expect(service.preview(delta)).toMatchObject({
      valid: true,
      delta: 'changed',
      changedSections: ['party']
    })
    const applied = service.apply(delta)
    expect(applied).toMatchObject({
      status: 'applied',
      campaignId: first.campaignId
    })
    const afterHashes = entityHashes(campaigns.activeCampaignDatabase())
    const afterIds = entityIds(campaigns.activeCampaignDatabase())
    expect(afterHashes.get('party:pc:hank')).not.toBe(
      beforeHashes.get('party:pc:hank')
    )
    for (const [key, hash] of beforeHashes)
      if (key !== 'party:pc:hank') expect(afterHashes.get(key), key).toBe(hash)
    expect(afterIds).toEqual(beforeIds)
    const members = new PartyStore(campaigns.activeCampaignDatabase()).read()
      .members
    const hank = members.find((member) => member.name === 'Hank')
    expect(hank?.passivePerception).toBe(12)
    expect(members).toContainEqual(
      expect.objectContaining({ id: localId, name: 'Local-only companion' })
    )
    expect(entityCount(campaigns.activeCampaignDatabase())).toBe(7)
    campaigns.close()
  })

  it('leaves the active campaign untouched when staged population fails', () => {
    const { campaigns } = harness()
    const original = campaigns.create('Existing')
    const activeId = original.activeCampaignId
    const party = new PartyStore(campaigns.activeCampaignDatabase())
    party.create(
      {
        name: 'Must survive',
        playerName: null,
        species: null,
        characterClass: null,
        languages: [],
        level: null,
        passivePerception: null,
        passiveInvestigation: null,
        passiveInsight: null,
        armorClass: null,
        movementSpeedFeet: null
      },
      party.read().revision
    )
    expect(() =>
      campaigns.stageImportedCampaign('Broken import', activeId, (staged) => {
        staged.prepare('DELETE FROM player_characters').run()
        throw new Error('readback failed')
      })
    ).toThrow('readback failed')
    expect(campaigns.list()).toMatchObject({
      activeCampaignId: activeId,
      campaigns: [expect.objectContaining({ id: activeId, name: 'Existing' })]
    })
    expect(
      new PartyStore(campaigns.activeCampaignDatabase()).read().members
    ).toEqual([expect.objectContaining({ name: 'Must survive' })])
    campaigns.close()
  })

  it('recovers the prior campaign after interruption between replacement renames', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-import-crash-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const created = campaigns.create('Recover me')
    const id = created.activeCampaignId!
    campaigns.close()
    const replacement = join(root, 'campaigns', '.replacing', id)
    mkdirSync(join(root, 'campaigns', '.replacing'), { recursive: true })
    renameSync(join(root, 'campaigns', id), replacement)

    const recovered = new CampaignStore(root)
    expect(recovered.list()).toMatchObject({
      activeCampaignId: id,
      campaigns: [expect.objectContaining({ id, name: 'Recover me' })]
    })
    expect(
      recovered.activeCampaignDatabase().pragma('quick_check', { simple: true })
    ).toBe('ok')
    recovered.close()
  })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-import-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  return {
    campaigns,
    service: new CampaignImportService(campaigns, resolver)
  }
}

function fixture(): CampaignImportBundle {
  return campaignImportBundleSchema.parse(
    JSON.parse(
      readFileSync(
        'tests/fixtures/campaign-import/tower-of-time-6098.json',
        'utf8'
      )
    )
  )
}

function entityCount(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>
): number {
  return (
    db
      .prepare('SELECT COUNT(*) AS count FROM campaign_import_entity')
      .get() as {
      count: number
    }
  ).count
}

function entityHashes(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>
): ReadonlyMap<string, string> {
  const rows = db
    .prepare(
      `SELECT entity_kind AS kind, external_key AS externalKey,
              content_hash AS contentHash FROM campaign_import_entity`
    )
    .all() as Array<{ kind: string; externalKey: string; contentHash: string }>
  return new Map(
    rows.map((row) => [`${row.kind}:${row.externalKey}`, row.contentHash])
  )
}

function entityIds(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>
): ReadonlyMap<string, string> {
  const rows = db
    .prepare(
      `SELECT entity_kind AS kind, external_key AS externalKey,
              internal_id AS internalId FROM campaign_import_entity`
    )
    .all() as Array<{ kind: string; externalKey: string; internalId: string }>
  return new Map(
    rows.map((row) => [`${row.kind}:${row.externalKey}`, row.internalId])
  )
}

function semanticProjection(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>
): unknown {
  const source = db
    .prepare(
      `SELECT source_id AS id, source_revision AS revision,
              sections_json AS sectionsJson FROM campaign_import_provenance`
    )
    .get() as { id: string; revision: number; sectionsJson: string }
  const externalRows = db
    .prepare(
      `SELECT entity_kind AS kind, external_key AS externalKey,
              internal_id AS internalId FROM campaign_import_entity`
    )
    .all() as Array<{ kind: string; externalKey: string; internalId: string }>
  const external = new Map(
    externalRows.map((row) => [
      `${row.kind}:${row.internalId}`,
      row.externalKey
    ])
  )
  const party = new PartyStore(db).read().members
  const locations = new WorldLocationStore(db).read().locations
  const factionStore = new WorldFactionStore(db, {
    containsTable: () => false,
    containsCreature: () => false
  })
  const factions = factionStore.read().factions
  const npcs = new WorldNpcStore(db, resolver).readAllForReferences().npcs
  const factionNames = new Map(
    factions.map((value) => [value.id, value.displayName])
  )
  const locationNames = new Map(
    locations.map((value) => [value.id, value.displayName])
  )
  const sections: unknown = JSON.parse(source.sectionsJson)
  return {
    source: {
      id: source.id,
      revision: source.revision,
      sections
    },
    party: party.map((member) => ({
      externalKey: external.get(`party:${member.id}`),
      name: member.name,
      species: member.species,
      languages: member.languages,
      passivePerception: member.passivePerception
    })),
    locations: locations.map((location) => location.displayName),
    factions: factions.map((faction) => faction.displayName),
    npcs: npcs.map((npc) => ({
      externalKey: external.get(`npcs:${npc.id}`),
      name: npc.displayName,
      creatureId: npc.creatureId,
      faction: npc.factionId ? factionNames.get(npc.factionId) : null,
      location: npc.locationId ? locationNames.get(npc.locationId) : null
    }))
  }
}
