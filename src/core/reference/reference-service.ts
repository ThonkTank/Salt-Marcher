import { z } from 'zod'
import referenceCatalogDocument from './srd-5.1.generated.json' with { type: 'json' }
import {
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceTargetSchema,
  type ReferenceCandidate,
  type ReferenceDocument,
  type ReferenceIndex,
  type ReferenceTarget
} from '../../shared/contracts/reference.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  creatureCatalogManifest,
  creatures,
  type CreatureCatalogService
} from '../creatures/catalog.js'
import type { Creature } from '../../shared/contracts/encounter.js'
import type { WorldLocationService } from '../worldplanner/location-store.js'
import type { EncounterSourceService } from '../application/encounter-source-service.js'

const catalogSchema = z
  .object({
    manifest: z
      .object({
        catalogVersion: z.string(),
        apiRoot: z.url(),
        officialSource: z.url(),
        sourceContentHash: z.string(),
        license: z.literal('CC-BY-4.0'),
        attribution: z.string(),
        endpointCounts: z.record(z.string(), z.number().int().nonnegative())
      })
      .strict(),
    entries: z.array(
      z
        .object({
          aliases: z.array(z.string().min(1)),
          document: referenceDocumentSchema
        })
        .strict()
    )
  })
  .strict()

const catalog = catalogSchema.parse(referenceCatalogDocument)
const staticDocuments = new Map(
  catalog.entries.map((entry) => [targetKey(entry.document.target), entry])
)

export class ReferenceService {
  constructor(
    private readonly creatureCatalog: CreatureCatalogService,
    private readonly locations: WorldLocationService,
    private readonly sources: EncounterSourceService,
    private readonly activeCampaignId: () => string
  ) {}

  index(): ReferenceIndex {
    const terms = new Map<
      string,
      {
        term: string
        matchMode: 'folded' | 'exact'
        candidates: Map<string, ReferenceCandidate>
      }
    >()
    const add = (
      term: string,
      matchMode: 'folded' | 'exact',
      candidate: ReferenceCandidate
    ) => {
      const trimmed = term.trim()
      if (!trimmed) return
      const lookup = `${matchMode}:${
        matchMode === 'folded' ? trimmed.toLocaleLowerCase('en-US') : trimmed
      }`
      const current = terms.get(lookup) ?? {
        term: trimmed,
        matchMode,
        candidates: new Map()
      }
      current.candidates.set(targetKey(candidate.target), candidate)
      terms.set(lookup, current)
    }

    for (const entry of catalog.entries)
      for (const alias of entry.aliases)
        add(alias, 'folded', candidateFor(entry.document))

    for (const creature of creatures)
      add(creature.name, 'folded', {
        target: { kind: 'creature', id: creature.id },
        title: creature.name,
        context: 'Creature Statblock'
      })

    const locations = this.locations.read()
    for (const location of locations.locations)
      add(location.displayName, 'exact', {
        target: { kind: 'location', id: location.id },
        title: location.displayName,
        context: 'Campaign Location'
      })

    const factions = this.sources.readFactions()
    for (const faction of factions.factions)
      add(faction.displayName, 'exact', {
        target: { kind: 'faction', id: faction.id },
        title: faction.displayName,
        context: 'Campaign Faction'
      })

    return referenceIndexSchema.parse({
      revision: [
        catalog.manifest.sourceContentHash,
        creatureCatalogManifest.sourceHash,
        this.activeCampaignId(),
        locations.revision,
        factions.revision
      ].join(':'),
      terms: [...terms.values()]
        .map((term) => ({
          term: term.term,
          matchMode: term.matchMode,
          candidates: [...term.candidates.values()].toSorted(candidateOrder)
        }))
        .toSorted(
          (left, right) =>
            right.term.length - left.term.length ||
            left.term.localeCompare(right.term)
        )
    })
  }

  detail(input: ReferenceTarget): ReferenceDocument {
    const target = referenceTargetSchema.parse(input)
    const staticEntry = staticDocuments.get(targetKey(target))
    if (staticEntry) return staticEntry.document
    if (target.kind === 'creature')
      return creatureDocument(this.creatureCatalog.detail(target.id))
    if (target.kind === 'action' && target.sectionId)
      return creatureActionDocument(
        this.creatureCatalog.detail(target.id),
        target
      )
    if (target.kind === 'location') {
      const location = this.locations
        .read()
        .locations.find((candidate) => candidate.id === target.id)
      if (!location) throw new CapabilityError('not_found', false)
      return referenceDocumentSchema.parse({
        target,
        title: location.displayName,
        context: 'Campaign Location',
        summary: location.notes,
        facts: [
          { label: 'Factions', value: String(location.factionIds.length) },
          {
            label: 'Encounter Tables',
            value: String(location.encounterTableIds.length)
          }
        ],
        sections: location.notes
          ? [{ id: 'notes', title: 'Notes', paragraphs: [location.notes] }]
          : [],
        source: null
      })
    }
    if (target.kind === 'faction') {
      const faction = this.sources
        .readFactions()
        .factions.find((candidate) => candidate.id === target.id)
      if (!faction) throw new CapabilityError('not_found', false)
      return referenceDocumentSchema.parse({
        target,
        title: faction.displayName,
        context: 'Campaign Faction',
        summary: faction.notes,
        facts: [
          { label: 'Disposition', value: String(faction.disposition) },
          { label: 'Finite Stock', value: String(faction.inventory.length) }
        ],
        sections: faction.notes
          ? [{ id: 'notes', title: 'Notes', paragraphs: [faction.notes] }]
          : [],
        source: null
      })
    }
    throw new CapabilityError('not_found', false)
  }
}

function creatureDocument(creature: Creature): ReferenceDocument {
  return referenceDocumentSchema.parse({
    target: { kind: 'creature', id: creature.id },
    title: creature.name,
    context: 'Creature Statblock',
    summary: creature.details,
    facts: [
      { label: 'Armor Class', value: String(creature.ac) },
      { label: 'Hit Points', value: `${creature.hp} (${creature.hitDice})` },
      { label: 'Speed', value: creature.speed },
      { label: 'Challenge', value: creature.challengeRating }
    ],
    sections: [],
    source: {
      title: creatureCatalogManifest.sourceDocument,
      version: creatureCatalogManifest.catalogVersion,
      url: creatureCatalogManifest.source,
      attribution: creatureCatalogManifest.attribution
    },
    creature
  })
}

function creatureActionDocument(
  creature: Creature,
  target: ReferenceTarget
): ReferenceDocument {
  const [kind, rawPosition] = target.sectionId!.split(':')
  const position = Number(rawPosition)
  const entries =
    kind === 'trait'
      ? creature.traits
      : kind === 'legendary'
        ? creature.legendaryActions
        : kind === 'action'
          ? creature.actions
          : []
  const action = entries[position]
  if (!action) throw new CapabilityError('not_found', false)
  return referenceDocumentSchema.parse({
    target,
    title: action.name,
    context: `${creature.name} · ${
      kind === 'trait'
        ? 'Trait'
        : kind === 'legendary'
          ? 'Legendary Action'
          : 'Action'
    }`,
    summary: action.description,
    facts: [],
    sections: [
      {
        id: target.sectionId,
        title: action.name,
        paragraphs: [action.description]
      }
    ],
    source: {
      title: creatureCatalogManifest.sourceDocument,
      version: creatureCatalogManifest.catalogVersion,
      url: creatureCatalogManifest.source,
      attribution: creatureCatalogManifest.attribution
    }
  })
}

function candidateFor(document: ReferenceDocument): ReferenceCandidate {
  return {
    target: document.target,
    title: document.title,
    context: document.context
  }
}

function targetKey(target: ReferenceTarget): string {
  return `${target.kind}:${target.id}:${target.sectionId ?? ''}`
}

function candidateOrder(
  left: ReferenceCandidate,
  right: ReferenceCandidate
): number {
  return (
    (left.context ?? '').localeCompare(right.context ?? '') ||
    left.title.localeCompare(right.title) ||
    targetKey(left.target).localeCompare(targetKey(right.target))
  )
}
