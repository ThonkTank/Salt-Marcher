import type { CampaignImportBundle } from '../../shared/contracts/campaign-import.js'
import {
  duplicateConflicts,
  importedEntity,
  planSection,
  previousEntityId,
  type CampaignImportAdapterContext,
  type CampaignImportConflict,
  type CampaignImportSectionAdapter
} from '../campaign-import/campaign-import-section-adapter.js'
import { PartyStore } from './party-store.js'

type PartyImportValue = CampaignImportBundle['party'][number]

export class PartyImportAdapter implements CampaignImportSectionAdapter<PartyImportValue> {
  readonly section = 'party' as const
  readonly dependencies = [] as const

  select(bundle: CampaignImportBundle) {
    return bundle.party
  }

  validate(
    values: readonly PartyImportValue[],
    context: CampaignImportAdapterContext
  ): CampaignImportConflict[] {
    const records = values as readonly Record<string, unknown>[]
    const conflicts = [
      ...duplicateConflicts(
        records,
        'externalKey',
        this.section,
        'duplicate_external_key'
      ),
      ...duplicateConflicts(
        records,
        'name',
        this.section,
        'duplicate_display_name'
      )
    ]
    const resolutions = new Map(
      context.bundle.resolutions.map((decision) => [decision.path, decision])
    )
    values.forEach((member, index) => {
      if (member.species && member.species.source !== member.species.resolved)
        requireResolution(
          resolutions,
          `party.${index}.species`,
          'species',
          member.species.resolved,
          conflicts
        )
      member.languages.forEach((language, languageIndex) => {
        if (language.source !== language.resolved)
          requireResolution(
            resolutions,
            `party.${index}.languages.${languageIndex}`,
            'language',
            language.resolved,
            conflicts
          )
      })
    })
    return conflicts
  }

  diff: CampaignImportSectionAdapter<PartyImportValue>['diff'] = (
    _currentProjection,
    values,
    context
  ) => planSection(this.section, values, context)

  apply: CampaignImportSectionAdapter<PartyImportValue>['apply'] = (
    database,
    plan,
    context
  ) => {
    const party = new PartyStore(database)
    if (context.phase === 'remove') {
      for (const mapping of plan.removed)
        if (
          party
            .read()
            .members.some((member) => member.id === mapping.internalId)
        )
          party.delete(mapping.internalId, party.read().revision)
      return []
    }

    return plan.values.map((member, index) => {
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
      const existingId = previousEntityId(
        context,
        this.section,
        member.externalKey
      )
      const current = party.read()
      const snapshot =
        existingId && current.members.some((value) => value.id === existingId)
          ? party.update(existingId, draft, current.revision)
          : party.create(draft, current.revision)
      const saved = existingId
        ? snapshot.members.find((value) => value.id === existingId)
        : snapshot.members.at(-1)
      if (!saved) throw new Error('Imported party member failed readback')
      const finalSnapshot = saved.active
        ? snapshot
        : party.setMembership(saved.id, true, snapshot.revision)
      const finalMember = finalSnapshot.members.find(
        (value) => value.id === saved.id
      )
      if (!finalMember?.active)
        throw new Error('Imported party membership failed readback')
      context.resolvedIds.set(`${this.section}:${member.externalKey}`, saved.id)
      return importedEntity(this.section, member, saved.id, `party.${index}`)
    })
  }

  readBack: CampaignImportSectionAdapter<PartyImportValue>['readBack'] = (
    database,
    plan,
    _context,
    entities
  ) => {
    const snapshot = new PartyStore(database).read()
    const expected = plan.values.map((value) => value.externalKey).sort()
    const entityIds = new Map(
      entities.map((entity) => [entity.externalKey, entity.internalId])
    )
    const actual = plan.values
      .filter((value) =>
        snapshot.members.some(
          (member) =>
            member.id === entityIds.get(value.externalKey) && member.active
        )
      )
      .map((value) => value.externalKey)
      .sort()
    return {
      name: this.section,
      expected,
      actual,
      passed: expected.length === actual.length
    }
  }

  summarize: CampaignImportSectionAdapter<PartyImportValue>['summarize'] = (
    readBack
  ) => {
    return Array.isArray(readBack.actual) ? readBack.actual.length : 0
  }
}

function requireResolution(
  decisions: ReadonlyMap<string, CampaignImportBundle['resolutions'][number]>,
  path: string,
  kind: CampaignImportBundle['resolutions'][number]['kind'],
  resolvedValue: string,
  conflicts: CampaignImportConflict[]
): void {
  const decision = decisions.get(path)
  if (
    !decision ||
    decision.kind !== kind ||
    decision.resolvedValue !== resolvedValue
  )
    conflicts.push({
      code: 'missing_resolution',
      path,
      sourcePath: path,
      parameters: { kind, resolvedValue }
    })
}
