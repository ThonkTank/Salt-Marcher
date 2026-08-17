import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  campaignImportBundleSchema,
  campaignImportReportSchema,
  type CampaignImportApplyResult,
  type CampaignImportBundle,
  type CampaignImportReport,
  type CampaignImportSection
} from '../../shared/contracts/campaign-import.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { fingerprint } from '../fingerprint.js'
import { PartyStore } from '../party/party-store.js'
import type { CampaignStore } from '../persistence/sqlite/campaign-store.js'
import { WorldFactionStore } from '../worldplanner/faction-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import {
  WorldNpcStore,
  type CreatureReferenceResolver
} from '../worldplanner/npc-store.js'
import { CampaignImportStore } from './campaign-import-store.js'

const emptySummary = Object.freeze({
  party: 0,
  locations: 0,
  factions: 0,
  npcs: 0
})

type Conflict = CampaignImportReport['conflicts'][number]
type ImportedEntity = Readonly<{
  kind: CampaignImportSection
  externalKey: string
  internalId: string
  sourcePath: string
  contentHash: string
}>

export function campaignImportExportHash(bundle: CampaignImportBundle): string {
  return fingerprint({
    ...bundle,
    source: { ...bundle.source, exportHash: '0'.repeat(64) }
  })
}

export class CampaignImportService {
  private readonly imports: CampaignImportStore

  constructor(
    private readonly campaigns: CampaignStore,
    private readonly creatures: CreatureReferenceResolver
  ) {
    this.imports = new CampaignImportStore(campaigns.installationDatabase())
  }

  validate(value: unknown): CampaignImportReport {
    return this.report(value, false)
  }

  preview(value: unknown): CampaignImportReport {
    return this.report(value, true)
  }

  apply(value: unknown): CampaignImportApplyResult {
    const report = this.preview(value)
    if (!report.valid) throw new CapabilityError('validation_failed', false)
    const bundle = campaignImportBundleSchema.parse(value)
    const previous = this.imports.previous(bundle.source.id)
    const summary = summaryFor(bundle)
    if (report.delta === 'unchanged' && previous) {
      this.campaigns.activate(previous.campaignId)
      return {
        status: 'unchanged',
        campaignId: previous.campaignId,
        sourceId: bundle.source.id,
        sourceRevision: bundle.source.revision,
        exportHash: bundle.source.exportHash,
        summary
      }
    }
    const staged = this.campaigns.stageImportedCampaign(
      bundle.campaign.name,
      previous?.campaignId ?? null,
      (database) => this.populateAndReadBack(database, bundle)
    )
    this.imports.recordRegistry(bundle, staged.campaignId)
    return {
      status: 'applied',
      campaignId: staged.campaignId,
      sourceId: bundle.source.id,
      sourceRevision: bundle.source.revision,
      exportHash: bundle.source.exportHash,
      summary
    }
  }

  private report(
    value: unknown,
    includePrevious: boolean
  ): CampaignImportReport {
    const parsed = campaignImportBundleSchema.safeParse(value)
    if (!parsed.success) {
      const conflicts: Conflict[] = parsed.error.issues
        .slice(0, 100)
        .map((issue) => ({
          code: 'invalid_bundle',
          path: issue.path.join('.'),
          sourcePath: issue.path.join('.'),
          parameters: { issue: issue.code }
        }))
      return campaignImportReportSchema.parse({
        valid: false,
        sourceId: null,
        sourceRevision: null,
        exportHash: null,
        previous: null,
        delta: 'new',
        changedSections: [],
        summary: emptySummary,
        conflicts
      })
    }
    const bundle = parsed.data
    const previous = includePrevious
      ? this.imports.previous(bundle.source.id)
      : null
    const conflicts = this.bundleConflicts(bundle)
    if (campaignImportExportHash(bundle) !== bundle.source.exportHash)
      conflicts.push(
        conflict('export_hash_mismatch', 'source.exportHash', {
          actual: campaignImportExportHash(bundle)
        })
      )
    let delta: CampaignImportReport['delta'] = previous ? 'changed' : 'new'
    if (previous) {
      if (bundle.campaign.externalKey !== previous.campaignExternalKey)
        conflicts.push(
          conflict('invalid_bundle', 'campaign.externalKey', {
            previous: previous.campaignExternalKey,
            incoming: bundle.campaign.externalKey
          })
        )
      if (bundle.source.revision < previous.revision) {
        delta = 'regressed'
        conflicts.push(
          conflict('source_revision_regressed', 'source.revision', {
            previous: previous.revision,
            incoming: bundle.source.revision
          })
        )
      } else if (
        bundle.source.revision === previous.revision &&
        bundle.source.exportHash !== previous.exportHash
      ) {
        delta = 'reused-revision'
        conflicts.push(
          conflict('source_revision_reused', 'source.revision', {
            revision: bundle.source.revision
          })
        )
      } else if (bundle.source.exportHash === previous.exportHash)
        delta = 'unchanged'
    }
    const changedSections = this.changedSections(
      bundle,
      previous?.campaignId ?? null,
      delta
    )
    conflicts.sort((left, right) =>
      `${left.path}:${left.code}`.localeCompare(`${right.path}:${right.code}`)
    )
    return campaignImportReportSchema.parse({
      valid: conflicts.length === 0,
      sourceId: bundle.source.id,
      sourceRevision: bundle.source.revision,
      exportHash: bundle.source.exportHash,
      previous: previous
        ? { revision: previous.revision, exportHash: previous.exportHash }
        : null,
      delta,
      changedSections,
      summary: summaryFor(bundle),
      conflicts
    })
  }

  private bundleConflicts(bundle: CampaignImportBundle): Conflict[] {
    const conflicts: Conflict[] = []
    const sections = [
      ['party', bundle.party],
      ['locations', bundle.locations],
      ['factions', bundle.factions],
      ['npcs', bundle.npcs]
    ] as const
    for (const [kind, values] of sections) {
      const records = values as readonly Record<string, unknown>[]
      checkDuplicates(
        records,
        'externalKey',
        kind,
        conflicts,
        'duplicate_external_key'
      )
      checkDuplicates(
        records,
        kind === 'party' ? 'name' : 'displayName',
        kind,
        conflicts,
        'duplicate_display_name'
      )
      if (values.length > 0 && !bundle.source.sections.includes(kind))
        conflicts.push(
          conflict('invalid_bundle', `source.sections`, { missing: kind })
        )
    }
    const locations = new Set(
      bundle.locations.map((value) => value.externalKey)
    )
    const factions = new Set(bundle.factions.map((value) => value.externalKey))
    const resolutions = new Map(
      bundle.resolutions.map((decision) => [decision.path, decision])
    )
    for (const [index, member] of bundle.party.entries()) {
      if (member.species && member.species.source !== member.species.resolved)
        requireResolution(
          resolutions,
          `party.${index}.species`,
          'species',
          member.species.resolved,
          conflicts
        )
      for (const [languageIndex, language] of member.languages.entries())
        if (language.source !== language.resolved)
          requireResolution(
            resolutions,
            `party.${index}.languages.${languageIndex}`,
            'language',
            language.resolved,
            conflicts
          )
    }
    for (const [index, npc] of bundle.npcs.entries()) {
      if (!this.creatures.resolve(npc.creature.resolvedId))
        conflicts.push(
          conflict('unknown_statblock', `npcs.${index}.creature.resolvedId`, {
            value: npc.creature.resolvedId
          })
        )
      requireResolution(
        resolutions,
        `npcs.${index}.creature`,
        'statblock',
        npc.creature.resolvedId,
        conflicts
      )
      if (npc.locationExternalKey !== null) {
        if (!locations.has(npc.locationExternalKey))
          conflicts.push(
            conflict('unknown_location', `npcs.${index}.locationExternalKey`, {
              value: npc.locationExternalKey
            })
          )
        requireResolution(
          resolutions,
          `npcs.${index}.locationExternalKey`,
          'location',
          npc.locationExternalKey,
          conflicts
        )
      }
      if (npc.factionExternalKey !== null) {
        if (!factions.has(npc.factionExternalKey))
          conflicts.push(
            conflict('unknown_faction', `npcs.${index}.factionExternalKey`, {
              value: npc.factionExternalKey
            })
          )
        requireResolution(
          resolutions,
          `npcs.${index}.factionExternalKey`,
          'faction',
          npc.factionExternalKey,
          conflicts
        )
      }
    }
    return conflicts
  }

  private changedSections(
    bundle: CampaignImportBundle,
    previousCampaignId: string | null,
    delta: CampaignImportReport['delta']
  ): CampaignImportSection[] {
    if (delta === 'unchanged') return []
    if (
      previousCampaignId === null ||
      delta === 'regressed' ||
      delta === 'reused-revision'
    )
      return [...bundle.source.sections]
    const hashes = this.campaigns
      .visitCampaignDatabases(({ id, database }) =>
        id === previousCampaignId
          ? this.imports.entityHashes(database, bundle.source.id)
          : null
      )
      .find((value): value is ReadonlyMap<string, string> => value !== null)
    if (!hashes) return [...bundle.source.sections]
    const changed = new Set<CampaignImportSection>()
    const incomingKeys = new Set<string>()
    for (const [kind, values] of entityGroups(bundle))
      for (const value of values) {
        const key = `${kind}:${value.externalKey}`
        incomingKeys.add(key)
        if (hashes.get(key) !== fingerprint(value)) changed.add(kind)
      }
    for (const key of hashes.keys())
      if (!incomingKeys.has(key))
        changed.add(key.slice(0, key.indexOf(':')) as CampaignImportSection)
    return bundle.source.sections.filter((section) => changed.has(section))
  }

  private populateAndReadBack(
    db: Database.Database,
    bundle: CampaignImportBundle
  ): void {
    const entities: ImportedEntity[] = []
    const party = new PartyStore(db)
    const locations = new WorldLocationStore(db)
    const noEncounterReferences = {
      containsTable: () => false,
      containsCreature: () => false
    }
    const factions = new WorldFactionStore(db, noEncounterReferences)
    const npcs = new WorldNpcStore(db, this.creatures)
    const previousMappings = this.imports.entityMappings(db, bundle.source.id)
    const previousIds = new Map(
      previousMappings.map((mapping) => [
        `${mapping.kind}:${mapping.externalKey}`,
        mapping.internalId
      ])
    )
    this.deleteRemovedEntities(
      bundle,
      previousMappings,
      party,
      locations,
      factions,
      npcs
    )

    for (const [index, member] of bundle.party.entries()) {
      const draft = {
        name: member.name,
        playerName: member.playerName,
        species: member.species?.resolved ?? null,
        characterClass: member.characterClass,
        languages: member.languages.map((language) => language.resolved),
        level: member.level,
        passivePerception: member.passivePerception,
        passiveInvestigation: member.passiveInvestigation,
        passiveInsight: member.passiveInsight,
        armorClass: member.armorClass,
        movementSpeedFeet: member.movementSpeedFeet
      }
      const existingId = previousIds.get(`party:${member.externalKey}`)
      const snapshot =
        existingId &&
        party.read().members.some((value) => value.id === existingId)
          ? party.update(existingId, draft, party.read().revision)
          : party.create(draft, party.read().revision)
      const saved = existingId
        ? snapshot.members.find((value) => value.id === existingId)
        : snapshot.members.at(-1)
      if (!saved) throw new Error('Imported party member failed readback')
      if (!saved.active) party.setMembership(saved.id, true, snapshot.revision)
      entities.push(entity('party', member, saved.id, `party.${index}`))
    }

    const locationIds = new Map<string, string>()
    for (const [index, location] of bundle.locations.entries()) {
      const draft = {
        displayName: location.displayName,
        tags: location.tags,
        readAloud: location.readAloud,
        notes: location.notes,
        factionIds: [],
        encounterTableIds: []
      }
      const existingId = previousIds.get(`locations:${location.externalKey}`)
      const receipt =
        existingId && locations.exists(existingId)
          ? locations.update(existingId, draft, locations.read().revision)
          : locations.create(draft, locations.read().revision)
      locationIds.set(location.externalKey, receipt.saved.id)
      entities.push(
        entity('locations', location, receipt.saved.id, `locations.${index}`)
      )
    }

    const factionIds = new Map<string, string>()
    for (const [index, faction] of bundle.factions.entries()) {
      const draft = {
        displayName: faction.displayName,
        notes: faction.notes,
        disposition: faction.disposition,
        primaryEncounterTableId: null,
        inventory: []
      }
      const existingId = previousIds.get(`factions:${faction.externalKey}`)
      const receipt =
        existingId && factions.contains(existingId)
          ? factions.update(
              randomUUID(),
              existingId,
              draft,
              factions.read().revision
            )
          : factions.create(randomUUID(), draft, factions.read().revision)
      factionIds.set(faction.externalKey, receipt.saved.id)
      entities.push(
        entity('factions', faction, receipt.saved.id, `factions.${index}`)
      )
    }

    for (const [index, npc] of bundle.npcs.entries()) {
      const draft = {
        displayName: npc.displayName,
        creatureId: npc.creature.resolvedId,
        lifecycle: npc.lifecycle,
        appearance: npc.appearance,
        behavior: npc.behavior,
        history: npc.history,
        notes: npc.notes,
        dispositionModifier: npc.dispositionModifier,
        factionId: npc.factionExternalKey
          ? requireMapped(factionIds, npc.factionExternalKey)
          : null,
        locationId: npc.locationExternalKey
          ? requireMapped(locationIds, npc.locationExternalKey)
          : null
      }
      const existingId = previousIds.get(`npcs:${npc.externalKey}`)
      const receipt =
        existingId && npcs.detail(existingId)
          ? npcs.update(
              randomUUID(),
              existingId,
              draft,
              npcs.currentRevision(),
              factions.read().revision,
              factions
            )
          : npcs.create(
              randomUUID(),
              draft,
              npcs.currentRevision(),
              npc.factionExternalKey === null ? null : factions.read().revision,
              factions
            )
      entities.push(entity('npcs', npc, receipt.saved.id, `npcs.${index}`))
    }
    this.imports.recordProvenance(db, bundle, entities)
    assertReadback(db, bundle, entities, this.creatures)
  }

  private deleteRemovedEntities(
    bundle: CampaignImportBundle,
    previous: ReturnType<CampaignImportStore['entityMappings']>,
    party: PartyStore,
    locations: WorldLocationStore,
    factions: WorldFactionStore,
    npcs: WorldNpcStore
  ): void {
    const incoming = new Set(
      entityGroups(bundle).flatMap(([kind, values]) =>
        values.map((value) => `${kind}:${value.externalKey}`)
      )
    )
    const removed = previous.filter(
      (mapping) => !incoming.has(`${mapping.kind}:${mapping.externalKey}`)
    )
    for (const mapping of removed.filter((value) => value.kind === 'npcs'))
      if (npcs.detail(mapping.internalId))
        npcs.delete(
          randomUUID(),
          mapping.internalId,
          npcs.currentRevision(),
          factions.read().revision,
          factions
        )
    for (const mapping of removed.filter((value) => value.kind === 'party'))
      if (
        party.read().members.some((member) => member.id === mapping.internalId)
      )
        party.delete(mapping.internalId, party.read().revision)
    for (const mapping of removed.filter((value) => value.kind === 'locations'))
      if (locations.exists(mapping.internalId))
        locations.delete(mapping.internalId, locations.read().revision)
    for (const mapping of removed.filter((value) => value.kind === 'factions'))
      if (factions.contains(mapping.internalId))
        factions.delete(
          randomUUID(),
          mapping.internalId,
          factions.read().revision
        )
  }
}

function summaryFor(bundle: CampaignImportBundle) {
  return {
    party: bundle.party.length,
    locations: bundle.locations.length,
    factions: bundle.factions.length,
    npcs: bundle.npcs.length
  }
}

function entityGroups(bundle: CampaignImportBundle) {
  return [
    ['party', bundle.party],
    ['locations', bundle.locations],
    ['factions', bundle.factions],
    ['npcs', bundle.npcs]
  ] as const
}

function entity(
  kind: CampaignImportSection,
  value: { externalKey: string },
  internalId: string,
  sourcePath: string
): ImportedEntity {
  return {
    kind,
    externalKey: value.externalKey,
    internalId,
    sourcePath,
    contentHash: fingerprint(value)
  }
}

function conflict(
  code: Conflict['code'],
  path: string,
  parameters: Conflict['parameters']
): Conflict {
  return { code, path, sourcePath: path, parameters }
}

function requireResolution(
  decisions: ReadonlyMap<string, CampaignImportBundle['resolutions'][number]>,
  path: string,
  kind: CampaignImportBundle['resolutions'][number]['kind'],
  resolvedValue: string,
  conflicts: Conflict[]
): void {
  const decision = decisions.get(path)
  if (
    !decision ||
    decision.kind !== kind ||
    decision.resolvedValue !== resolvedValue
  )
    conflicts.push(
      conflict('missing_resolution', path, { kind, resolvedValue })
    )
}

function checkDuplicates(
  values: readonly Record<string, unknown>[],
  field: string,
  path: string,
  conflicts: Conflict[],
  code: 'duplicate_external_key' | 'duplicate_display_name'
): void {
  const seen = new Map<string, number>()
  values.forEach((value, index) => {
    const canonical = String(value[field]).trim().toLocaleLowerCase()
    const first = seen.get(canonical)
    if (first === undefined) seen.set(canonical, index)
    else
      conflicts.push(
        conflict(code, `${path}.${index}.${String(field)}`, { first })
      )
  })
}

function requireMapped(
  values: ReadonlyMap<string, string>,
  key: string
): string {
  const value = values.get(key)
  if (!value) throw new Error(`Import reference was not mapped: ${key}`)
  return value
}

function assertReadback(
  db: Database.Database,
  bundle: CampaignImportBundle,
  entities: readonly ImportedEntity[],
  creatures: CreatureReferenceResolver
): void {
  const party = new PartyStore(db).read()
  const locations = new WorldLocationStore(db).read()
  const factions = new WorldFactionStore(db, {
    containsTable: () => false,
    containsCreature: () => false
  }).read()
  const npcs = new WorldNpcStore(db, creatures).readAllForReferences()
  const importedIds = new Map(
    entities.map((entity) => [
      `${entity.kind}:${entity.externalKey}`,
      entity.internalId
    ])
  )
  if (
    entities.length !==
    Object.values(summaryFor(bundle)).reduce((sum, value) => sum + value, 0)
  )
    throw new Error('Imported campaign failed complete domain readback')
  if (
    bundle.party.some((value) => {
      const id = importedIds.get(`party:${value.externalKey}`)
      return !party.members.some((member) => member.id === id && member.active)
    }) ||
    bundle.locations.some(
      (value) =>
        !locations.locations.some(
          (location) =>
            location.id === importedIds.get(`locations:${value.externalKey}`)
        )
    ) ||
    bundle.factions.some(
      (value) =>
        !factions.factions.some(
          (faction) =>
            faction.id === importedIds.get(`factions:${value.externalKey}`)
        )
    ) ||
    bundle.npcs.some(
      (value) =>
        !npcs.npcs.some(
          (npc) => npc.id === importedIds.get(`npcs:${value.externalKey}`)
        )
    )
  )
    throw new Error('Imported party membership failed readback')
}
