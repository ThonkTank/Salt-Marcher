import {
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceTargetSchema,
  type ReferenceCandidate,
  type ReferenceDocument,
  type ReferenceIndex,
  type ReferenceInline,
  type ReferenceTarget,
  type ReferenceTerm
} from '../../shared/contracts/reference.js'
import type {
  Creature,
  CreatureAction
} from '../../shared/contracts/creature.js'
import type { WorldLocationSnapshot } from '../../shared/contracts/world-location.js'
import type { WorldFactionSnapshot } from '../../shared/contracts/encounter-source.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { referenceTargetKey } from '../../shared/reference/reference-target-key.js'
import { creatureCatalogManifest } from '../creatures/catalog.js'

export interface StaticReferenceCatalog {
  index(): ReferenceIndex
  detail(target: ReferenceTarget): ReferenceDocument
}

export interface ReferenceCreatureQueries {
  all(): readonly Creature[]
  detail(id: string): Creature
}

export interface ReferenceLocationQueries {
  read(): WorldLocationSnapshot
}

export interface ReferenceFactionQueries {
  read(): WorldFactionSnapshot
}

export class ReferenceService {
  constructor(
    private readonly catalog: StaticReferenceCatalog,
    private readonly creatureQueries: ReferenceCreatureQueries,
    private readonly locationQueries: ReferenceLocationQueries,
    private readonly factionQueries: ReferenceFactionQueries,
    private readonly activeCampaignId: () => string
  ) {}

  staticIndex(): ReferenceIndex {
    const catalogIndex = this.catalog.index()
    const terms = new Map<string, MutableTerm>()
    for (const term of catalogIndex.terms) mergeTerm(terms, term)
    for (const creature of this.creatureQueries.all()) {
      addCandidate(terms, creature.name, 'folded', {
        target: { scope: 'creature', creatureId: creature.id },
        title: creature.name
      })
      addCreatureParts(terms, creature, 'trait', creature.traits)
      addCreatureParts(terms, creature, 'action', creature.actions)
      addCreatureParts(
        terms,
        creature,
        'legendary-action',
        creature.legendaryActions
      )
    }
    return referenceIndexSchema.parse({
      scope: 'static',
      revision: `${catalogIndex.revision}:${creatureCatalogManifest.sourceHash}`,
      terms: sortedTerms(terms)
    })
  }

  campaignIndex(campaignId: string): ReferenceIndex {
    this.assertCampaign(campaignId)
    const locations = this.locationQueries.read()
    const factions = this.factionQueries.read()
    const terms = new Map<string, MutableTerm>()
    for (const location of locations.locations)
      addCandidate(terms, location.displayName, 'exact', {
        target: {
          scope: 'campaign',
          campaignId,
          entityKind: 'location',
          entityId: location.id
        },
        title: location.displayName
      })
    for (const faction of factions.factions)
      addCandidate(terms, faction.displayName, 'exact', {
        target: {
          scope: 'campaign',
          campaignId,
          entityKind: 'faction',
          entityId: faction.id
        },
        title: faction.displayName
      })
    return referenceIndexSchema.parse({
      scope: 'campaign',
      revision: `${campaignId}:${locations.revision}:${factions.revision}`,
      terms: sortedTerms(terms)
    })
  }

  detail(input: ReferenceTarget): ReferenceDocument {
    const target = referenceTargetSchema.parse(input)
    if (target.scope === 'srd') return this.catalog.detail(target)
    if (target.scope === 'creature')
      return creatureDocument(this.creatureQueries.detail(target.creatureId))
    if (target.scope === 'creature-part')
      return creaturePartDocument(
        this.creatureQueries.detail(target.creatureId),
        target
      )
    this.assertCampaign(target.campaignId)
    return target.entityKind === 'location'
      ? locationDocument(this.locationQueries.read(), target)
      : factionDocument(this.factionQueries.read(), target)
  }

  private assertCampaign(campaignId: string): void {
    if (campaignId !== this.activeCampaignId())
      throw new CapabilityError('not_found', false)
  }
}

type MutableTerm = {
  term: string
  matchMode: 'folded' | 'exact'
  candidates: Map<string, ReferenceCandidate>
}

function addCreatureParts(
  terms: Map<string, MutableTerm>,
  creature: Creature,
  partKind: 'trait' | 'action' | 'legendary-action',
  actions: readonly CreatureAction[]
): void {
  for (const action of actions)
    addCandidate(terms, action.name, 'folded', {
      target: {
        scope: 'creature-part',
        creatureId: creature.id,
        partKind,
        partId: action.id
      },
      title: `${action.name} — ${creature.name}`
    })
}

function addCandidate(
  terms: Map<string, MutableTerm>,
  term: string,
  matchMode: 'folded' | 'exact',
  candidate: ReferenceCandidate
): void {
  const trimmed = term.trim()
  if (!trimmed) return
  const normalized =
    matchMode === 'folded'
      ? trimmed.normalize('NFKC').toLocaleLowerCase('en-US')
      : trimmed
  const key = `${matchMode}:${normalized}`
  const current = terms.get(key) ?? {
    term: trimmed,
    matchMode,
    candidates: new Map()
  }
  current.candidates.set(referenceTargetKey(candidate.target), candidate)
  terms.set(key, current)
}

function mergeTerm(terms: Map<string, MutableTerm>, term: ReferenceTerm): void {
  for (const candidate of term.candidates)
    addCandidate(terms, term.term, term.matchMode, candidate)
}

function sortedTerms(terms: Map<string, MutableTerm>): ReferenceTerm[] {
  return [...terms.values()]
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
}

function creatureDocument(creature: Creature): ReferenceDocument {
  return referenceDocumentSchema.parse({
    documentKind: 'creature',
    target: { scope: 'creature', creatureId: creature.id },
    title: creature.name,
    creature,
    source: creatureSource()
  })
}

function creaturePartDocument(
  creature: Creature,
  target: Extract<ReferenceTarget, { scope: 'creature-part' }>
): ReferenceDocument {
  const actions =
    target.partKind === 'trait'
      ? creature.traits
      : target.partKind === 'action'
        ? creature.actions
        : creature.legendaryActions
  const action = actions.find((candidate) => candidate.id === target.partId)
  if (!action) throw new CapabilityError('not_found', false)
  return article(target, action.name, [], action.description, creatureSource())
}

function locationDocument(
  snapshot: WorldLocationSnapshot,
  target: Extract<ReferenceTarget, { scope: 'campaign' }>
): ReferenceDocument {
  const location = snapshot.locations.find(
    (entry) => entry.id === target.entityId
  )
  if (!location) throw new CapabilityError('not_found', false)
  return article(
    target,
    location.displayName,
    [
      ['Factions', String(location.factionIds.length)],
      ['Encounter Tables', String(location.encounterTableIds.length)]
    ],
    location.notes,
    null
  )
}

function factionDocument(
  snapshot: WorldFactionSnapshot,
  target: Extract<ReferenceTarget, { scope: 'campaign' }>
): ReferenceDocument {
  const faction = snapshot.factions.find(
    (entry) => entry.id === target.entityId
  )
  if (!faction) throw new CapabilityError('not_found', false)
  return article(
    target,
    faction.displayName,
    [
      ['Disposition', String(faction.disposition)],
      ['Finite Stock', String(faction.inventory.length)]
    ],
    faction.notes,
    null
  )
}

function article(
  target: ReferenceTarget,
  title: string,
  facts: readonly (readonly [string, string])[],
  body: string,
  source: ReturnType<typeof creatureSource> | null
): ReferenceDocument {
  const inline = (text: string): ReferenceInline[] => [{ kind: 'text', text }]
  return referenceDocumentSchema.parse({
    documentKind: 'article',
    target,
    title,
    facts: facts.map(([label, value]) => ({ label, value: inline(value) })),
    blocks: body.trim()
      ? [{ kind: 'paragraph', inlines: inline(body.trim()) }]
      : [],
    source
  })
}

function creatureSource() {
  return {
    title: creatureCatalogManifest.sourceDocument,
    version: creatureCatalogManifest.catalogVersion,
    url: creatureCatalogManifest.source,
    attribution: creatureCatalogManifest.attribution
  }
}

function candidateOrder(
  left: ReferenceCandidate,
  right: ReferenceCandidate
): number {
  return (
    left.title.localeCompare(right.title) ||
    referenceTargetKey(left.target).localeCompare(
      referenceTargetKey(right.target)
    )
  )
}
